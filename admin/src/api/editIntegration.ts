import { request } from "@strapi/helper-plugin";
import { ControllerResponse, EditIntegrationPayload } from 'types/payloads';
import { Integration } from 'types/data';

const editIntegration = async (payload: EditIntegrationPayload) => {
  return request(`/content-transfer/integrations/${payload.id}`, { method: 'put', body: payload }) as ControllerResponse<Integration>;
};

export default editIntegration;