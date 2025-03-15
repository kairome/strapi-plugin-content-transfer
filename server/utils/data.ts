import * as _ from 'lodash';
import { ApiEntity, Entity, ErrorDetailItem, ErrorItem, LocalesInfo, RelationFields } from 'types/data';
import { AxiosError } from 'axios';

export const prepareEntityData = (entity: Entity, relationFields: RelationFields, getNewMediaFile: Function, getNewRelation: Function) => {

  const recurDataFn = (value: Entity, parentKey?: string) => {
    if ('localizations' in value) {
      delete value.localizations;
    }

    return _.reduce(value, (acc, val, key) => {
      const fullKey = _.isNumber(key) ? parentKey : _.join(_.compact([parentKey, key]), '.');

      if (_.isObject(val) && 'mime' in val && 'url' in val) {
        const oldFile = val as any;
        const newFile = getNewMediaFile(oldFile.id, oldFile.name);
        acc[key] = newFile ?? { ...val, id: undefined };
        return acc;
      }

      if (_.isObject(val) || _.isArray(val)) {
        const relationField = relationFields[fullKey];

        if (relationField) {
          acc[key] = getNewRelation(relationField, val);
          return acc;
        }
      }

      if (key === 'id') {
        return acc;
      }

      if (_.isObject(val) || _.isArray(val)) {
        const newParentKey = _.isObject(val) && '__component' in val ? `${fullKey}.${val.__component}` : fullKey;
        acc[key] = recurDataFn(val as any, newParentKey);
      } else {
        acc[key] = val;
      }

      return acc;
    }, _.isArray(value) ? [] : {});
  };

  return recurDataFn(entity);
};

export const getFullCollectionSchema = (getModel: Function, collectionId: string) => {
  const collectionModel = getModel(collectionId);
  const schema = collectionModel.__schema__.attributes;

  const result = _.reduce(schema, (acc, val, key) => {
    if (val.type === 'component') {
      acc[key] = {
        ...val,
        fields: getFullCollectionSchema(getModel, val.component),
      };

      return acc;
    }

    if (val.type === 'dynamiczone') {
      acc[key] = _.map(val.components, zoneCmp => ({
        type: 'component',
        component: zoneCmp,
        fields: getFullCollectionSchema(getModel, zoneCmp)
      }));
      return acc;
    }

    acc[key] = val;

    return acc;
  }, {});

  return result;
};

export const getRelationFields = (getModel: Function, collectionId: string, parentKey?: string, repeatable?: boolean, dynamicZone?: boolean) => {
  const collectionModel = getModel(collectionId);
  const schema = collectionModel.__schema__.attributes;

  return _.reduce(schema, (acc, val, key) => {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;

    if (val.type === 'relation') {
      acc[fullKey] = { uid: val.target, type: val.relation, repeatable, dynamicZone };
    }

    if (val.type === 'component') {
      return {
        ...acc,
        ...getRelationFields(getModel, val.component, fullKey, val.repeatable, false),
      };
    }

    if (val.type === 'dynamiczone') {
      const zoneCmps = _.reduce(val.components, (acc, zoneCmp) => {
        return {
          ...acc,
          ...getRelationFields(getModel, zoneCmp, `${fullKey}.${zoneCmp}`, false, true),
        };
      }, {});

      return { ...acc, ...zoneCmps };
    }

    return acc;
  }, {});
};

export const getAllEntityMedia = (entity: Entity) => {
  const res = _.reduce(entity, (acc, val: Entity) => {
    if (_.isObject(val)) {
      if ('mime' in val && 'url' in val) {
        acc.push(val);
        return acc;
      }

      const nestedMedia = getAllEntityMedia(val);
      acc.push(...nestedMedia);
      return acc;
    }

    return acc;
  }, []);

  return _.uniqBy(res, 'id');
};

export const getEntitiesRelationValues = (entities: Entity[], relationFields: RelationFields) => {
  const mergeVals = (objVal: Entity[] | undefined, sourceVal: Entity[] | undefined) => {
    return _.uniqBy(_.concat(objVal ?? [], sourceVal ?? []), 'id');
  };

  const recurDataFn = (value: Entity, parentKey?: string) => {
    return _.reduce(value, (acc, val, key) => {
      const fullKey = _.isNumber(key) ? parentKey : _.join(_.compact([parentKey, key]), '.');

      if (_.isObject(val) || _.isArray(val)) {
        const relationField = relationFields[fullKey];

        if (relationField) {
          const previousVal = acc[relationField.uid] ?? [];
          const resultVal = Array.isArray(val) ? val : [val];
          acc[relationField.uid] = _.uniqBy(_.concat(previousVal, resultVal), 'id');
          return acc;
        }

        const newParentKey = _.isObject(val) && '__component' in val ? `${fullKey}.${val.__component}` : fullKey;
        const nestedResult = recurDataFn(val as Entity, newParentKey);
        return _.isEmpty(nestedResult) ? acc : _.mergeWith(acc, nestedResult, mergeVals);
      }

      return acc;
    }, {});
  };

  return _.reduce(entities, (acc, val) => {
    const relationVals = recurDataFn(val);
    const localizedRelationVals = getEntitiesRelationValues(val.localizations, relationFields);
    const relationsWithLocalizedVals = _.mergeWith(relationVals, localizedRelationVals, mergeVals);
    return _.mergeWith(acc, relationsWithLocalizedVals, mergeVals);
  }, {});
};

export const getCollectionPopulateSchema = (getModel: Function, collectionId: string) => {
  const collectionModel = getModel(collectionId);
  const schema = collectionModel.__schema__.attributes;


  if (collectionModel.modelType === 'component') {
    const populateTypes = ['component', 'relation', 'media', 'dynamiczone'];

    return _.reduce(schema, (acc, val, key) => {
      if (_.includes(populateTypes, val.type)) {
        const populateVal = val.type === 'component' ? getCollectionPopulateSchema(getModel, val.component) : true;
        const populateField = {
          [key]: populateVal,
        };

        if (val.type === 'dynamiczone') {
          const zoneComponents = _.reduce(val.components, (acc, zoneComponent) => ({
            ...acc,
            [zoneComponent]: getCollectionPopulateSchema(getModel, zoneComponent),
          }), {});

          populateField[key] = {
            on: zoneComponents,
          };
        }

        const prevPopulate = acc?.populate ?? {};
        return {
          populate: {
            ...prevPopulate,
            ...populateField,
          },
        };
      }

      return acc;
    }, {} as any);
  }

  return _.reduce(schema, (acc, val, key) => {
    if (val.type === 'media' || val.type === 'relation') {
      acc[key] = true;
    }

    if (val.type === 'component') {
      acc[key] = getCollectionPopulateSchema(getModel, val.component);
    }

    if (val.type === 'dynamiczone') {
      const zoneComponents = _.reduce(val.components, (acc, zoneComponent) => ({
        ...acc,
        [zoneComponent]: getCollectionPopulateSchema(getModel, zoneComponent),
      }), {});

      acc[key] = {
        on: zoneComponents,
      };
    }
    return acc;
  }, {});
};

export const getFilterQueryByMainField = (data: Entity[], mainField: string) => {
  const fullQuery = _.reduce(data, (acc, entity, index) => {
    const queryValue = encodeURIComponent(entity[mainField]);
    const query = `filters[${mainField}][$in][${index}]=${queryValue}`;
    if (!acc) {
      return query;
    }
    return `${acc}&${query}`;
  }, '');

  return `${fullQuery}&pagination[limit]=10000&publicationState=preview`;
};


export const getErrorDetails = (error: AxiosError): ErrorDetailItem[] => {
  if (!error.response) {
    return [];
  }

  const { data } = error.response;

  const genericDetails = [{
    message: String(error),
    name: 'Axios error'
  }];

  if (!data) {
    return genericDetails;
  }

  const dataErr = (data as any).error;
  if (!dataErr) {
    return genericDetails;
  }

  if (_.isEmpty(dataErr.details) || _.isEmpty(dataErr.details?.errors)) {
    return [
      {
        message: dataErr.message || String(error),
        name: 'Request error',
      }
    ];
  }

  return dataErr.details.errors;
};

export const getConnectedLocalizations = (remoteLocalizations: ApiEntity[], localLocalizations: Entity[], mainField: string, mainLocale: string) => {
  return _.reduce(remoteLocalizations, (acc, val) => {
    const { attributes } = val;
    const connectedLocale = _.find(localLocalizations, c => c.locale === attributes.locale && c[mainField] === attributes[mainField]);
    if (connectedLocale) {
      const localizationIds = [...acc.localizations];
      localizationIds.push(val.id);

      acc.localizations = localizationIds;

      if (!acc.mainLocaleParent) {
        const mainLocaleEntity = _.find(attributes?.localizations?.data, d => d.attributes.locale === mainLocale);
        acc.mainLocaleParent = mainLocaleEntity ?? null;
      }
    }

    return acc;
  }, { localizations: [], mainLocaleParent: null } as { localizations: number[], mainLocaleParent: ApiEntity | null });
};

export const prepareEntitiesByDefaultLocale = (entities: Entity[], localesInfo: LocalesInfo) => {
  const { localDefaultLocale, remoteDefaultLocale, availableRemoteLocales } = localesInfo;

  if (localDefaultLocale === remoteDefaultLocale) {
    // filter by available locales
    if (_.isEmpty(availableRemoteLocales)) {
      return entities;
    }

    return _.map(entities, (entity) => {
      if (_.isEmpty(entity.localizations) || !entity.locale) {
        return entity;
      }

      entity.localizations = _.filter(entity.localizations, loc => _.includes(availableRemoteLocales, loc.locale));
      return entity;
    });
  }

  return _.reduce(entities, (acc, val) => {
    // entities without localizations
    if (!val.locale) {
      acc.push(val);
      return acc;
    }

    const localizations = _.isEmpty(val.localizations) ? [] : val.localizations;

    const defaultEntity = _.find(localizations, loc => loc.locale === remoteDefaultLocale);

    if (!defaultEntity) {
      return acc;
    }

    const otherLocales = _.without(localizations, defaultEntity);

    otherLocales.push({
      ...val,
      localizations: undefined,
    });

    const newLocalizations = _.isEmpty(availableRemoteLocales) ? otherLocales : _.filter(otherLocales, loc => _.includes(availableRemoteLocales, loc.locale));

    acc.push({
      ...defaultEntity,
      localizations: newLocalizations,
    })
    return acc;
  }, [] as Entity[]);
};