import { request } from '@strapi/helper-plugin';
import { ControllerResponse } from 'types/payloads';

const deleteIntegration = async (id: number) => {
  return request(`/content-transfer/integrations/${id}`, { method: 'delete' }) as ControllerResponse<number>;
};

export default deleteIntegration;