import { mergeTimeSeries } from './telemetry.service';

describe('mergeTimeSeries', () => {
  it('returns an empty array for a non-array reply', () => {
    expect(mergeTimeSeries(null)).toEqual([]);
    expect(mergeTimeSeries(undefined)).toEqual([]);
    expect(mergeTimeSeries('oops')).toEqual([]);
  });

  it('parses a single series', () => {
    const raw = [
      ['api:metrics:GET_/search', [], [[1000, '2'], [2000, '3']]],
    ];
    expect(mergeTimeSeries(raw)).toEqual([
      { timestamp: 1000, value: 2 },
      { timestamp: 2000, value: 3 },
    ]);
  });

  it('sums values from multiple series into shared buckets, sorted by time', () => {
    const raw = [
      ['api:metrics:GET_/search', [], [[2000, '3'], [1000, '2']]],
      ['api:metrics:POST_/ingestion/upload', [], [[1000, '5']]],
    ];
    expect(mergeTimeSeries(raw)).toEqual([
      { timestamp: 1000, value: 7 },
      { timestamp: 2000, value: 3 },
    ]);
  });

  it('skips malformed datapoints instead of failing', () => {
    const raw = [
      ['key', [], [[1000, 'not-a-number'], [2000, '4'], ['bad'], null]],
      ['broken-series'],
    ];
    expect(mergeTimeSeries(raw)).toEqual([{ timestamp: 2000, value: 4 }]);
  });
});
