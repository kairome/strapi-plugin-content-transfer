import { Strapi } from '@strapi/strapi';
import { RemoteStrapiClient } from '../utils/request';
import { AddIntegrationPayload } from '../../types/payloads';
import * as _ from 'lodash';
import { ApiEntitiesResponse, ErrorItem } from '../../types/data';
import { AxiosError } from 'axios';

export default ({ strapi }: { strapi: Strapi }) => ({
  async getIntegrations(ctx: any) {
    const service = strapi.plugin('content-transfer').service('integrationsService');
    ctx.body = await service.getIntegrations();
  },
  async createIntegration(ctx: any) {
    const service = strapi.plugin('content-transfer').service('integrationsService');
    const payload: AddIntegrationPayload = ctx.request.body;

    const collection = _.find(strapi.contentTypes, val => _.startsWith(val.uid, 'api::'));

    if (!collection) {
      ctx.body = {
        data: null,
        errors: [{ message: 'Something went wrong verifying the token.', field: 'token', }],
      };

      return;
    }

    const errors: ErrorItem[] = [];
    const integrationTestApi = new RemoteStrapiClient(payload.url, payload.token, collection.info.pluralName);
    integrationTestApi.setTimeout(10000);

    try {
      const resp = await integrationTestApi.fetch<ApiEntitiesResponse | string>('');
      if (typeof resp === 'string') {
        const message = _.includes(resp, 'This site does not exist') ? 'The site does not exist' : 'Provided url did not return the expected strapi response.';
        errors.push({ message, field: 'url' });
      } else {
        if (!resp || !resp?.data || !resp?.meta) {
          errors.push({ message: 'Provided url did not return an expected response. It is probably not a valid strapi instance.', field: 'url' });
        }
      }
    } catch (err) {
      const errResponse = (err as AxiosError).response;
      if (errResponse && errResponse.status === 401) {
        errors.push({ message: 'Token is invalid.', field: 'token' });
      } else {
        errors.push({ message: `Failed to verify token: ${err}`, field: 'token' });
      }
    } finally {
      if (!_.isEmpty(errors)) {
        ctx.body = {
          data: null,
          errors,
        };
        return;
      }
    }

    try {
      await integrationTestApi.create('');
    } catch (err) {
      const errResponse = (err as AxiosError).response;
      if (errResponse) {
        if (errResponse.status === 403) {
          errors.push({
            message: 'Token must have full access. Provided token lacks write permissions',
            field: 'token',
          });
        } else if (errResponse.status !== 400) {
          errors.push({
            message: `Failed to verify write access: ${err}`,
            field: 'token',
          });
        }
      }
    }

    if (!_.isEmpty(errors)) {
      ctx.body = {
        data: null,
        errors,
      };

      return;
    }

    ctx.body = await service.createIntegration(payload);
  },
  async updateIntegration(ctx: any) {
    const service = strapi.plugin('content-transfer').service('integrationsService');
    ctx.body = await service.updateIntegration(ctx.params.integrationId, ctx.request.body);
  },
  async deleteIntegration(ctx: any) {
    const service = strapi.plugin('content-transfer').service('integrationsService');
    ctx.body = await service.deleteIntegration(ctx.params.integrationId);
  },
});