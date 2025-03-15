import { request } from "@strapi/helper-plugin";
import { ControllerResponse, UploadEntitiesPayload } from 'types/payloads';
import { Entity } from 'types/data';

const uploadEntities = async (payload: UploadEntitiesPayload) => {
  return request(`/content-transfer/entities/upload`, { method: 'post', body: payload }) as ControllerResponse<Entity[]>;
};

export default uploadEntities;