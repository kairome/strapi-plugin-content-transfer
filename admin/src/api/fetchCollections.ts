import { request } from "@strapi/helper-plugin";
import { ControllerResponse } from 'types/payloads';
import { Collection } from 'types/data';

const fetchCollections = async () => {
  return request('/content-transfer/collections', { method: 'get' }) as ControllerResponse<Collection[]>;
};

export default fetchCollections;