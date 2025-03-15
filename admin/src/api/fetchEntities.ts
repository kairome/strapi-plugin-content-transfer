import { request } from "@strapi/helper-plugin";
import { ControllerResponse } from 'types/payloads';
import { Entity } from 'types/data';

const fetchEntities = async (collectionId: string) => {
  return request(`/content-transfer/collections/${collectionId}/entities`, { method: 'get' }) as ControllerResponse<Entity[]>;
};

export default fetchEntities;