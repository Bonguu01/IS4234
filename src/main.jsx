import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { AppStateProvider } from './state/AppState';
import { theme, cssVariablesResolver } from './ui/theme';
import App from './App';
import './ui/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light"><AppStateProvider><App /></AppStateProvider></MantineProvider></React.StrictMode>,
);
