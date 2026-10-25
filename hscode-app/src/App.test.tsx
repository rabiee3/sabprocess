import { render, screen } from '@testing-library/react';
import { Logo } from './ui/Logo';
it('renders the HSCode wordmark', () => {
  render(<Logo />);
  expect(screen.getByRole('img', { name: 'HSCode' })).toBeInTheDocument();
});
