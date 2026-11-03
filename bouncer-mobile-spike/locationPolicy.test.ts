import { classifyPerimeter, distanceBetweenMeters, shouldTransmitCoordinates } from './locationPolicy';

describe('location policy', () => {
  it('calculates distance between coordinates in metres', () => {
    expect(distanceBetweenMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 })).toBeCloseTo(111.2, 0);
  });

  it('uses accuracy bounds to avoid overstating perimeter presence', () => {
    expect(classifyPerimeter(20, 5, 30)).toBe('on_site');
    expect(classifyPerimeter(40, 5, 30)).toBe('off_site');
    expect(classifyPerimeter(28, 5, 30)).toBe('unknown');
  });

  it('never transmits coordinates before acknowledgement during an active incident', () => {
    expect(shouldTransmitCoordinates(true, false)).toBe(false);
    expect(shouldTransmitCoordinates(false, true)).toBe(false);
    expect(shouldTransmitCoordinates(true, true)).toBe(true);
  });
});
