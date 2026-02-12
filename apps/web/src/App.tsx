import { BrowserRouter } from 'react-router';
import { AppRoutes } from './router';

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
