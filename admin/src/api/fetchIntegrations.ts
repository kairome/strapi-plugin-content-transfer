import { request } from "@strapi/helper-plugin";
import { ControllerResponse } from 'types/payloads';
import { Integration } from 'types/data';

const fetchIntegrations = async () => {
  return request(`/content-transfer/integrations`, { method: 'get' }) as ControllerResponse<Integration[]>;
};

export default fetchIntegrations;