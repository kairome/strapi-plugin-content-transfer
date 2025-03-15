import { useState } from 'react';
import { ControllerResponse } from 'types/payloads';
import { ErrorItem } from 'types/data';
import _ from 'lodash';

type Request<TData, TPayload> = (payload: TPayload) => Promise<ControllerResponse<TData>>;

interface Options<TData> {
  onSuccess?: (data: TData) => void,
  onError?: (errors: ErrorItem[]) => void,
}

const useApi = <TData, TPayload = void>(request: Request<TData, TPayload>, options?: Options<TData>) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitial, setIsInitial] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [data, setData] = useState<TData | null>(null);
  const [errors, setErrors] = useState<ErrorItem[]>([]);

  const makeRequest = async (payload: TPayload) => {
    setIsLoading(true);
    setIsInitial(false);
    setIsSuccess(false);
    setErrors([]);
    setData(null);
    try {
      const resp = await request(payload);
      setData(resp.data);
      setErrors(resp.errors);
      const isSuccess = _.isEmpty(resp.errors);
      setIsSuccess(isSuccess);
      if (options) {
        if (isSuccess && options.onSuccess) {
          options.onSuccess(resp.data);
        }

        if (!isSuccess && options.onError) {
          options.onError(resp.errors);
        }
      }
    } catch (err) {
      setIsSuccess(false);
      const reqErrors = [{ message: err as string }];
      setErrors(reqErrors);
      if (options && options.onError) {
        options.onError(reqErrors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateData = (newData: TData | ((d: TData | null) => TData | null)) => {
    setData(newData);
  };

  const reset = () => {
    setData(null);
    setIsSuccess(false);
    setIsLoading(false);
    setIsInitial(true);
    setErrors([]);
  };

  return {
    makeRequest,
    isLoading,
    isInitial,
    isSuccess,
    data,
    errors,
    updateData,
    reset,
  };
};

export default useApi;