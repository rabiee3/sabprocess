import { render, screen } from '@testing-library/react';
import { Logo } from './Logo';
it('renders the HSCode wordmark', () => {
  render(<Logo />);
  expect(screen.getByRole('img', { name: 'HSCode' })).toBeInTheDocument();
});
