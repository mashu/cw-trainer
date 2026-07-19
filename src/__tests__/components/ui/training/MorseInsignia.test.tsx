import { render } from '@testing-library/react';

import { MorseInsignia } from '@/components/ui/training/MorseInsignia';

describe('MorseInsignia', () => {
  it('renders one pip per symbol, wider for dashes than dots', () => {
    const { container } = render(<MorseInsignia pattern="·−·" />);
    const pips = container.querySelectorAll('span > span');
    expect(pips).toHaveLength(3);
    // Dots are w-1.5, dashes are w-4.
    expect(pips[0]?.className).toContain('w-1.5');
    expect(pips[1]?.className).toContain('w-4');
    expect(pips[2]?.className).toContain('w-1.5');
  });

  it('applies the provided colour class to every pip', () => {
    const { container } = render(<MorseInsignia pattern="··" className="bg-amber-500" />);
    container.querySelectorAll('span > span').forEach((pip) => {
      expect(pip.className).toContain('bg-amber-500');
    });
  });
});
