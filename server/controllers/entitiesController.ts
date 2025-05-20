import { Strapi } from '@strapi/strapi';
import * as _ from 'lodash';
import {
  getAllEntityMedia,
  getCollectionPopulateSchema,
  getRelationFields,
  getEntitiesRelationValues,
} from '../utils/data';
import { RemoteStrapiClient } from '../utils/request';
import { UploadEntitiesPayload } from 'types/payloads';
import { Entity, IntegrationEntity } from 'types/data';
import { INTEGRATION_COLLECTION_UID } from '../utils/constants';

export default ({ strapi }: { strapi: Strapi }) => ({
  async getCollections(ctx: any) {
    ctx.body = await strapi.plugin('content-transfer').service('entitiesService').getCollections();
  },
  async getEntitiesByCollection(ctx: any) {
    ctx.body = await strapi.plugin('content-transfer').service('entitiesService').getEntitiesByCollection(ctx.params.collectionId);
  },

  async uploadEntities(ctx: any) {
    const payload: UploadEntitiesPayload = ctx.request.body;
    const { collection, entities, integrationId } = payload;

    const integration = await strapi.entityService?.findOne(INTEGRATION_COLLECTION_UID, integrationId) as IntegrationEntity;

    if (!integration) {
      return {
        data: [],
        errors: [{ message: `Integration with id ${integrationId} not found` }],
      };
    }

    const getStrapiModel = (collectionId: string) => strapi.getModel(collectionId as any);

    const populateSchema = getCollectionPopulateSchema(getStrapiModel, collection.id);

    const entitiesService = strapi.plugin('content-transfer').service('entitiesService');
    const relationFields = getRelationFields(getStrapiModel, collection.id);

    if (!_.isEmpty(entities)) {
      const createEntitiesWithFullData = await strapi.entityService?.findMany(collection.id, {
        populate: { ...populateSchema, localizations: true },
        filters: {
          id: _.map(entities, (entity: Entity) => entity.id),
        },
      } as any);

      // need to populate all fields in localizations in case the default locales differ/transferring locales
      for (const createEntityData of createEntitiesWithFullData as Entity[]) {
        const localeIds = _.map(createEntityData.localizations, l => l.id);
        createEntityData.localizations = await strapi.entityService?.findMany(collection.id, {
          populate: populateSchema,
          locale: 'all',
          filters: {
            id: localeIds,
          } as any,
        }) as any;
      }

      const relationValues = getEntitiesRelationValues(createEntitiesWithFullData as Entity[], relationFields);
      const mediaFiles = _.flatMap(createEntitiesWithFullData, getAllEntityMedia);

      const apiClient = new RemoteStrapiClient(integration.url, integration.token);
      const collectionApiName = collection.apiNamePlural;

      const { errors: uploadMediaErrors, media: newMediaFiles } = await entitiesService.uploadMedia({
        apiClient,
        mediaFiles,
        uploadMedia: payload.uploadMedia
      });

      const { newRelations, errors: relationErrors } = await entitiesService.getCreateRelations({
        apiClient,
        relations: relationValues,
        createMissingRelations: payload.createRelations,
        transferLocales: payload.transferLocales,
      });

      const { data, errors } = await entitiesService.createUpdateEntities({
        apiClient,
        collectionApiName,
        entities: createEntitiesWithFullData,
        collectionMainField: collection.mainField,
        transferLocales: payload.transferLocales,
        relationFields,
        newRelations,
        newMediaFiles,
      });

      ctx.body = {
        data,
        errors: _.concat(errors, uploadMediaErrors, relationErrors),
        newRelations,
      };
      return;
    }

    ctx.body = {
      data: [],
      errors: [],
    };
  }
});