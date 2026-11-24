// Backward-compatible wrapper delegating all legacy <PrintButtons /> usages to the unified <PrintIconButton />
import React from 'react';
import { PrintIconButton, type PrintIconButtonProps } from './PrintIconButton';

export type PrintButtonsProps = PrintIconButtonProps;

export const PrintButtons: React.FC<PrintButtonsProps> = (props) => {
  return <PrintIconButton {...props} />;
};

export { PrintIconButton };
