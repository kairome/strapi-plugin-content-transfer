import React, { useEffect, useRef } from 'react';

import {
  Alert as StrapiAlert,
} from '@strapi/design-system';

import styled from 'styled-components';

interface Props {
  show: boolean,
  variant: 'success' | 'danger',
  title: string,
  duration?: number,
  onClose: () => void,
}

const AlertContainer = styled.div`
  position: fixed;
  top: 30px;
  right: 30px;
  z-index: 999999;
`;

const Alert: React.FC<Props> = (props) => {
  const { show, onClose, duration = 3000, ...strapiAlertProps } = props;
  const alertTimer = useRef<number>();

  useEffect(() => {
    if (show) {
      if (alertTimer.current) {
        window.clearTimeout(alertTimer.current);
      }
      alertTimer.current = window.setTimeout(() => {
        onClose();
      }, duration);
    }

    return () => {
      if (alertTimer.current) {
        window.clearTimeout(alertTimer.current);
      }
    };
  }, [show]);

  if (!props.show) {
    return null;
  }

  return (
    <AlertContainer>
      <StrapiAlert
        {...strapiAlertProps}
        onClose={onClose}
      />
    </AlertContainer>
  );
};

export default Alert;