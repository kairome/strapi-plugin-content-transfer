import { Strapi } from '@strapi/strapi';
import { AddIntegrationPayload, EditIntegrationPayload } from '../../types/payloads';
import * as _ from 'lodash';
import { INTEGRATION_COLLECTION_UID } from '../utils/constants';

export default ({ strapi }: { strapi: Strapi }) => ({
  async getIntegrations() {
    const integrations = await strapi.entityService?.findMany(INTEGRATION_COLLECTION_UID, {
      fields: ['id', 'url', 'name']
    });
    return {
      data: integrations,
      errors: [],
    };
  },

  async createIntegration(data: AddIntegrationPayload) {
    try {
      const existingIntegrations = await strapi.entityService?.findMany(INTEGRATION_COLLECTION_UID, {
        filters: {
          $or: [
            { token: data.token },
            { url: data.url }
          ],
        },
      });

      if (!_.isEmpty(existingIntegrations)) {
        return {
          data: null,
          errors: [{ message: 'Integration with provided data already exists', field: 'url' }],
        };
      }

      const resp = await strapi.entityService?.create(INTEGRATION_COLLECTION_UID, { data });
      return {
        data: resp,
        errors: [],
      };
    } catch (err) {
      return {
        data: null,
        errors: [{ message: `Failed to create new integration: ${err}`, field: 'url' }]
      };
    }
  },
  async updateIntegration(integrationId: number, payload: EditIntegrationPayload) {
    try {
      const resp = await strapi.entityService?.update(INTEGRATION_COLLECTION_UID, integrationId, {
        data: {
          name: payload.name,
        } as any,
      });
      if (resp) {
        resp.token = '';
      }
      return {
        data: resp,
        errors: [],
      };
    } catch (err) {
      return {
        data: null,
        errors: [{ message: `Failed to update integration ${integrationId}: ${err}` }]
      };
    }
  },
  async deleteIntegration(integrationId: number) {
    try {
      const resp = await strapi.entityService?.delete(INTEGRATION_COLLECTION_UID, integrationId);
      return {
        data: resp?.id ?? null,
        errors: [],
      };
    } catch (err) {
      return {
        data: null,
        errors: [{ message: `Failed to delete integration ${integrationId}: ${err}` }]
      };
    }
  },
});