import { render, screen } from '@testing-library/react';
import App from './App';
it('renders the HSCode wordmark', () => {
  render(<App />);
  expect(screen.getByRole('img', { name: 'HSCode' })).toBeInTheDocument();
});
