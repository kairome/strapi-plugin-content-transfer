import axios, { Axios, AxiosInstance } from 'axios';

export class RemoteStrapiClient {
  private request: AxiosInstance;
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string, collectionApiName?: string) {
    const defaultUrl = `${baseUrl}/api`;
    this.baseUrl = baseUrl;
    this.token = token;
    const apiUrl = collectionApiName ? `${defaultUrl}/${collectionApiName}` : defaultUrl;
    this.request = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      withCredentials: false,
    });
  }

  public setTimeout(timeout: number) {
    this.request.defaults.timeout = timeout;
  }

  public async fetch<Data>(...args: Parameters<Axios['get']>): Promise<Data> {
    try {
      const resp = await this.request.get(...args);
      return resp.data;
    } catch (err) {
      throw err;
    }
  }

  public createCollectionClient(collectionApiName: string) {
    return new RemoteStrapiClient(this.baseUrl, this.token, collectionApiName);
  }

  get create() {
    return this.request.post;
  }

  get update() {
    return this.request.put;
  }

  get delete() {
    return this.request.delete;
  }
}
