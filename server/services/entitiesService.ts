import { Strapi } from '@strapi/strapi';
import _ from 'lodash';
import axios, { AxiosError } from 'axios';
import {
  CreateEntitiesPayload,
  UploadMediaPayload,
  CreateRelationsPayload,
  EntityLocalizationsPayload,
} from 'types/payloads';

import {
  ApiEntitiesResponse, ApiEntity,
  CollectionSettings,
  Entity,
  ErrorItem,
  LocalesInfo,
  MediaFile,
  RelationFields,
  RemoteLocaleInfo,
} from 'types/data';

import {
  prepareEntityData,
  getFilterQueryByMainField,
  getErrorDetails,
  prepareEntitiesByDefaultLocale,
} from '../utils/data';
import type { Common } from '@strapi/types/dist/types';
import { createParentRelation, getCreateLocaleParent } from './helpers/relations';
import { RemoteStrapiClient } from '../utils/request';
import { createEntityLocalization, updateEntity } from './helpers/entities';

const getCollections = async (strapi: Strapi) => {
  const settings = await strapi.db?.query('strapi::core-store').findMany({
    where: {
      value: {
        $containsi: 'uid',
      }
    }
  });
  const contentTypes = strapi.contentTypes;

  const apiCollections = _.filter(contentTypes, (val) => _.startsWith(val.uid, 'api::'));
  const collections = _.map(apiCollections, (collection) => {
    const collectionSettings = _.find(settings, setting => {
      const parsed = JSON.parse(setting.value);
      return parsed.uid === collection.uid;
    });

    const settingsValue: CollectionSettings = collectionSettings ? JSON.parse(collectionSettings.value) : null;
    return {
      name: collection.info.displayName,
      id: collection.uid,
      apiNameSingular: collection.info.singularName,
      apiNamePlural: collection.info.pluralName,
      mainField: settingsValue?.settings?.mainField,
    };
  });


  return {
    data: collections,
    errors: [],
  };
};

const getRemoteFilteredEntities = async (entities: Entity[], mainField: string, apiClient: RemoteStrapiClient, extraQueries?: string): Promise<ApiEntity[]> => {
  if (_.isEmpty(entities)) {
    return [];
  }

  const filterQuery = getFilterQueryByMainField(entities, mainField);
  const defaultQueries = `${filterQuery}&populate[localizations]=true`;
  const allQueries = extraQueries ? `${defaultQueries}&${extraQueries}` : defaultQueries;

  try {
    const { data } = await apiClient.fetch<ApiEntitiesResponse>(`?${allQueries}`);
    return data;
  } catch (err) {
    console.error(`Error getting filtered remote entities: ${err}`);
    return [];
  }
};

const uploadMedia = async (payload: UploadMediaPayload) => {
  const { apiClient, mediaFiles, uploadMedia } = payload;
  const errors: ErrorItem[] = [];

  try {
    const existingFiles = await apiClient.fetch<MediaFile[]>('/upload/files');

    const filesToUpload = _.differenceWith(mediaFiles, existingFiles, (mediaFile, existingFile: MediaFile) => {
      return mediaFile.name === existingFile.name && mediaFile.width === existingFile.width && mediaFile.height === existingFile.height;
    });

    const existingEntityFiles = _.difference(mediaFiles, filesToUpload);
    const existingMediaFiles = _.map(existingEntityFiles, (entityFile) => {
      const existingFile = _.find(existingFiles, f => f.name === entityFile.name && f.width === entityFile.width && f.height === entityFile.height);
      return existingFile ? { ...existingFile, localId: entityFile.id } : {
        ...entityFile,
        id: undefined,
        localId: entityFile.id
      };
    });

    if (!_.isEmpty(filesToUpload) && uploadMedia) {
      const uploadRequests = _.map(filesToUpload, async (file) => {
        const fileResponse = await axios.get(file.url, { responseType: 'arraybuffer' });
        if (fileResponse.data) {
          const blob = new Blob([fileResponse.data], { type: file.mime });
          const payload = new FormData();
          payload.set('files', blob, file.name);
          try {
            const resp = await apiClient.create('/upload', payload);
            const newFile = resp?.data[0] ?? null;
            return newFile ? { ...newFile, localId: file.id } : null;
          } catch (error) {
            errors.push({
              message: `Failed to upload file: ${file.name} with id ${file.id}`,
              details: getErrorDetails(error as AxiosError),
            });
            return null;
          }
        }
      });

      const uploadedFiles = await Promise.all(uploadRequests);
      uploadedFiles.push(...existingMediaFiles);

      return {
        media: _.compact(_.uniqBy(uploadedFiles, 'id')),
        errors,
      };
    }

    return {
      media: existingMediaFiles,
      errors,
    };
  } catch (err) {
    return {
      media: [],
      errors: [
        ...errors,
        {
          message: `Failed to fetch files: ${err}`,
        },
      ],
    };
  }
};

const getDefaultLocales = async (strapi: Strapi, apiClient: RemoteStrapiClient): Promise<LocalesInfo> => {
  const localDefaultLocale = await strapi.store?.({
    type: 'plugin',
    name: 'i18n'
  }).get({ key: 'default_locale' }) as string;

  try {
    const availableLocales = await apiClient.fetch<RemoteLocaleInfo[]>('/i18n/locales');
    const remoteDefaultLocale = _.find(availableLocales, l => l.isDefault);
    return {
      localDefaultLocale,
      remoteDefaultLocale: remoteDefaultLocale?.code ?? localDefaultLocale,
      availableRemoteLocales: _.map(availableLocales, l => l.code),
    };
  } catch (err) {
    console.error('Failed to fetch available remote locales: ', err);
    return {
      localDefaultLocale,
      remoteDefaultLocale: localDefaultLocale,
      availableRemoteLocales: [],
    };
  }
};

export default ({ strapi }: { strapi: Strapi }) => ({
  getCollections: () => getCollections(strapi),

  async getEntitiesByCollection(collectionId: Common.UID.ContentType) {
    const entities = await strapi.entityService?.findMany(collectionId, {});
    return {
      data: entities,
      errors: [],
    };
  },

  uploadMedia,
  async getCreateRelations(payload: CreateRelationsPayload) {
    const { relations, createMissingRelations, apiClient, transferLocales } = payload;

    const byKeyFilter = _.map(_.keys(relations), (relation) => ({
      key: {
        $containsi: relation,
      },
    }));

    const settings = await strapi.db?.query('strapi::core-store').findMany({
      where: {
        $or: byKeyFilter,
      }
    });

    const errors: ErrorItem[] = [];

    const localsInfo = await getDefaultLocales(strapi, apiClient);

    const requests = _.map(relations, async (oldRelations, relationKey: Common.UID.ContentType) => {
      const relationSettings = _.find(settings, s => _.includes(s.key, relationKey));

      if (!relationSettings) {
        return null;
      }

      const settingsVal: CollectionSettings = JSON.parse(relationSettings.value);
      const model = strapi.getModel(relationKey);

      const apiName = model.info.pluralName;

      const filteredRelations = _.filter(oldRelations, r => {
        return _.isEmpty(localsInfo.availableRemoteLocales) || _.includes(localsInfo.availableRemoteLocales, r.locale) || !r.locale;
      });

      const defaultLangRelations = _.filter(filteredRelations, r => r.locale === localsInfo.remoteDefaultLocale || !r.locale);
      const localizedRelations = _.difference(filteredRelations, defaultLangRelations);

      const mainField = settingsVal?.settings?.mainField;

      const collectionApiClient = apiClient.createCollectionClient(apiName);

      try {
        const defaultLangExistingRelations = await getRemoteFilteredEntities(defaultLangRelations, mainField, collectionApiClient);

        const newRelations: Entity[] = [];
        const createdLocaleParentRelations: Entity[] = [];

        if (transferLocales) {
          const remoteLocalizations = await getRemoteFilteredEntities(localizedRelations, mainField, collectionApiClient, 'locale=all');

          for (const localeRelation of localizedRelations) {
            const existingRemoteLocalization = _.find(remoteLocalizations, el => el.attributes[mainField] === localeRelation[mainField] && el.attributes.locale === localeRelation.locale);
            // TODO: fix types
            if (existingRemoteLocalization) {
              newRelations.push({
                ...existingRemoteLocalization.attributes,
                id: existingRemoteLocalization.id,
                oldId: localeRelation.id,
                modelId: relationKey,
              } as any);
              continue;
            }


            const relationEntity = await strapi.entityService?.findOne(relationKey, localeRelation.id, {
              populate: {
                localizations: true,
              },
              locale: 'all',
            });

            const currentLocaleLocalizations = relationEntity?.localizations ?? null;

            // each translation should be connected to a parent entity in default locale
            const defaultLocaleParent = _.find(currentLocaleLocalizations, l => l.locale === localsInfo.remoteDefaultLocale);

            if (!defaultLocaleParent) {
              errors.push({
                message: `Failed to find default locale relation`,
                details: [
                  {
                    message: `Default remote locale ${localsInfo.remoteDefaultLocale} has no entity for ${localeRelation[mainField]} (${localeRelation.locale}) in ${apiName}`,
                    name: 'Relation error'
                  }
                ],
              });
              continue;
            }

            // check if we already created the parent or fetched it from remote
            const existingDefaultParentRelation = _.find(defaultLangExistingRelations, existingRel => existingRel.attributes[mainField] === defaultLocaleParent[mainField]);
            const createdParentRelation = _.find(createdLocaleParentRelations, createdP => createdP[mainField] === defaultLocaleParent[mainField]);

            const remoteDefaultLangRelation = existingDefaultParentRelation ? {
              ...existingDefaultParentRelation.attributes,
              id: existingDefaultParentRelation.id,
              localizations: existingDefaultParentRelation.attributes?.localizations?.data as any,
            } as Entity : undefined;

            const existingParent = createdParentRelation ?? remoteDefaultLangRelation;

            const { data: localeParent, errors: localeParentErrors } = await getCreateLocaleParent({
              collectionApiClient,
              currentRelation: defaultLocaleParent,
              existingParent,
              mainField,
              createMissingRelations,
              modelId: relationKey,
              remoteLocalizations: remoteLocalizations,
              localLocalizations: currentLocaleLocalizations,
            });

            errors.push(...localeParentErrors);

            if (localeParent) {
              createdLocaleParentRelations.push(localeParent);
              const existingRemoteLocale = _.find(localeParent?.localizations, l => l?.attributes?.locale === localeRelation.locale);

              if (existingRemoteLocale) {
                const { data, errors } = await updateEntity({
                  createMissingRelations,
                  modelId: relationKey,
                  entity: localeRelation,
                  mainField,
                  collectionApiClient,
                  remoteEntityId: existingRemoteLocale.id,
                });

                errors.push(...errors);
                if (data) {
                  newRelations.push(data);
                }
              } else {
                const { data, errors } = await createEntityLocalization({
                  createMissingRelations,
                  modelId: relationKey,
                  entity: localeRelation,
                  mainField,
                  collectionApiClient,
                  parentId: localeParent.id,
                  otherLocaleIds: _.map((localeParent?.localizations as any)?.data, d => d.id),
                });

                errors.push(...errors);
                if (data) {
                  newRelations.push(data);
                }
              }
            } else {
              errors.push({
                message: `Failed to create localized relation in locale ${localeRelation.locale} for ${relationKey}: locale parent was not created.`
              });
            }
          }
        }

        // create default locale relations
        for (const oldRelation of defaultLangRelations) {
          // check if we already created the relation while transferring locales
          const createdParentRelation = _.find(createdLocaleParentRelations, cr => cr[mainField] === oldRelation[mainField]);

          if (createdParentRelation) {
            newRelations.push(createdParentRelation);
            continue;
          }

          const existingRelation = _.find(defaultLangExistingRelations, er => er.attributes[mainField] === oldRelation[mainField]);

          if (existingRelation) {
            newRelations.push({
              ...existingRelation.attributes,
              id: existingRelation.id,
              oldId: oldRelation.id,
              modelId: relationKey,
            } as any);
            continue;
          }

          const defaultLangRelationEntity = await strapi.entityService?.findOne(relationKey, oldRelation.id, {
            populate: {
              localizations: true,
            },
            locale: 'all',
          });

          const oldRelationLocalizations = defaultLangRelationEntity?.localizations ?? null;

          const existingOldLocalizations = await getRemoteFilteredEntities(oldRelationLocalizations, mainField, collectionApiClient, 'locale=all');

          const { data: newRelation, errors: newRelationErrors } = await createParentRelation({
            collectionApiClient,
            currentRelation: oldRelation,
            remoteLocalizations: existingOldLocalizations,
            localLocalizations: oldRelationLocalizations,
            mainField,
            createMissingRelations,
            modelId: relationKey,
          });

          errors.push(...newRelationErrors);

          if (newRelation) {
            newRelations.push(newRelation);
          }
        }

        return newRelations;
      } catch (err) {
        errors.push({
          message: `Failed to fetch relation ${relationKey}: ${err}`,
          details: getErrorDetails(err as AxiosError),
        });
        return null;
      }
    });

    const resp = await Promise.all(requests);
    const result = _.compact(_.flatten(resp));

    return {
      errors,
      newRelations: result,
    };
  },

  async createUpdateEntityLocalizations(payload: EntityLocalizationsPayload) {
    const {
      parentId,
      localizations,
      collectionApiClient,
      collectionMainField,
    } = payload;
    const errors: ErrorItem[] = [];
    const results: Entity[] = [];

    const localizationIds = _.compact(_.map(localizations, l => l.id));
    const createdLocalizationIds: number[] = [parentId];

    for (const localization of localizations) {
      try {
        if (localization.id) {
          const resp = await collectionApiClient.update(`/${localization.id}`, {
            data: {
              ...localization,
              id: undefined
            },
          });

          const { data } = resp.data;

          results.push({ ...data.attributes, id: data.id });
          continue;
        }

        const { data } = await collectionApiClient.create(`/${parentId}/localizations`, {
          ...localization,
          localizations: _.uniq(_.concat(localizationIds, createdLocalizationIds)),
        });

        // each translation should be connected between each other, so each new one must receive a list of existing/created translations
        createdLocalizationIds.push(data.id);

        results.push(data);
      } catch (err) {
        errors.push({
          message: `Failed to create/update locale ${localization.locale} for entity ${localization[collectionMainField]}`,
          details: getErrorDetails(err as AxiosError),
        });
      }
    }

    return {
      data: results,
      errors,
    };
  },

  async createUpdateEntities(payload: CreateEntitiesPayload) {
    const {
      entities,
      apiClient,
      collectionMainField,
      collectionApiName,
      relationFields,
      newRelations,
      newMediaFiles,
      transferLocales,
    } = payload;

    const collectionApiClient = apiClient.createCollectionClient(collectionApiName);

    const getNewMediaFile = (fileId: number, fileName: string) => {
      const fileById = _.find(newMediaFiles, { localId: fileId });
      if (fileById) {
        return fileById;
      }

      return _.find(newMediaFiles, { name: fileName });
    };

    const getNewRelation = (relationField: RelationFields, value: Entity | Entity[]) => {
      const isArray = _.isArray(value);
      const originalVal = isArray ? value : [value];

      const newVals = _.reduce(originalVal, (acc, val) => {
        const res = _.find(newRelations, r => r.oldId === val.id && relationField.uid === r.modelId);
        if (!res) {
          return acc;
        }

        // copy the result to keep oldId and modelId in the original data (relations without locale do not transfer to localized entities otherwise)
        const relationRes = _.omit(res, ['oldId', 'modelId']) as Entity;
        acc.push(relationRes);
        return acc;
      }, [] as Entity[]);

      if (_.isEmpty(newVals)) {
        return isArray ? [] : null;
      }

      return isArray ? newVals : newVals[0];
    };

    const localesInfo = await getDefaultLocales(strapi, apiClient);

    const entitiesByRemoteLocale = prepareEntitiesByDefaultLocale(entities, localesInfo);

    if (_.isEmpty(entitiesByRemoteLocale)) {
      return {
        data: [],
        errors: [
          { message: 'There are no entities to transfer after locale preparation' }
        ],
      };
    }

    try {
      const errors: ErrorItem[] = [];
      const results: Entity[] = [];

      const remoteLocaleLen = entitiesByRemoteLocale.length;
      const originalLen = entities.length;

      if (remoteLocaleLen !== originalLen) {
        errors.push({
          message: `There was a mismatch between original entities and entities by default remote locale: there are ${originalLen} original entities and ${remoteLocaleLen} default remote locale entities.`
        });
      }

      const remoteEntities = await getRemoteFilteredEntities(entitiesByRemoteLocale, collectionMainField, collectionApiClient);

      for (const entity of entitiesByRemoteLocale) {
        const remoteEntity = _.find(remoteEntities, v => v.attributes[collectionMainField] === entity[collectionMainField]);
        const entityLocalizations = entity.localizations ?? [];
        const newEntityData = prepareEntityData(entity, relationFields, getNewMediaFile, getNewRelation) as Entity;

        try {
          let newEntity: any = null;

          if (remoteEntity) {
            const { data } = await collectionApiClient.update(`/${remoteEntity.id}`, { data: newEntityData });
            newEntity = data;
          } else {
            // if remote doesn't have the entity, check for existing localizations and connect them to the created entity
            const existingLocalizations = await getRemoteFilteredEntities(entityLocalizations, collectionMainField, collectionApiClient, 'locale=all');

            const remoteDefaultLang = !_.isEmpty(existingLocalizations) ? _.find(existingLocalizations[0].attributes.localizations?.data, loc => loc.attributes.locale === entity.locale) : undefined;
            const localeIds = _.map(existingLocalizations, ex => ex.id);
            // there are translations, but no default lang entity
            if (!remoteDefaultLang && !_.isEmpty(existingLocalizations)) {
              // create and connect
              const parentId = existingLocalizations[0].id;

              const { data } = await collectionApiClient.create(`/${parentId}/localizations`, {
                ...newEntityData,
                localizations: localeIds,
              });

              // people at strapi should learn the consistency between responses for similar operations
              newEntity = {
                data: {
                  id: data.id,
                  attributes: data,
                },
                localizations: existingLocalizations,
              };

            } else {
              const entityId = remoteDefaultLang?.id;

              const request = entityId ? collectionApiClient.update : collectionApiClient.create;
              const url = entityId ? `/${entityId}` : '';

              const { data } = await request(url, {
                data: {
                  ...newEntityData,
                  localizations: localeIds,
                  locale: newEntityData.locale,
                }
              });
              newEntity = { ...data, localizations: existingLocalizations };
            }
          }

          if (transferLocales && newEntity) {
            const newLocalizationsData = _.map(entityLocalizations, (localization) => {
              const data = prepareEntityData(localization, relationFields, getNewMediaFile, getNewRelation) as Entity;

              const remoteExisting = _.find(remoteEntity?.attributes?.localizations?.data, v => v.attributes.locale === localization.locale);
              const newlyCreatedExisting = _.find(newEntity?.localizations, l => l.attributes.locale === localization.locale);

              const existingLocalizationId = remoteExisting?.id ?? newlyCreatedExisting?.id;

              if (existingLocalizationId) {
                data.id = existingLocalizationId;
              }

              return data;
            });

            const {
              data: newLocalizations,
              errors: localizationErrors
            } = await this.createUpdateEntityLocalizations({
              parentId: newEntity.data.id,
              localizations: newLocalizationsData,
              collectionApiClient,
              collectionMainField,
            });
            results.push(...newLocalizations);
            errors.push(...localizationErrors);
          }

          results.push({ id: newEntity?.data?.id, ...newEntity?.data?.attributes });
        } catch (err) {
          errors.push({
            message: `Failed to create/update entity: ${entity[collectionMainField]}`,
            details: getErrorDetails(err as AxiosError),
          });
        }
      }

      return {
        data: results,
        errors,
      };
    } catch (err) {
      return {
        data: [],
        errors: [{ message: `Failed to fetch remote entities: ${err}` }]
      };
    }

  },
});
