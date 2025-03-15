import { request } from "@strapi/helper-plugin";
import { ControllerResponse, AddIntegrationPayload } from 'types/payloads';
import { Integration } from 'types/data';

const addIntegration = async (payload: AddIntegrationPayload) => {
  return request(`/content-transfer/integrations`, { method: 'post', body: payload }) as ControllerResponse<Integration>;
};

export default addIntegration;