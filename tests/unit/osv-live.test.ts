import { describe, expect, it, vi } from 'vitest';

import { assessCvss } from '../../src/osv/cvss.js';
import { clearOsvCache, queryLiveOsv } from '../../src/osv/live.js';
import { OsvError } from '../../src/security/errors.js';
import type { Dependency } from '../../src/types/index.js';

const dependency: Dependency = {
  name: 'lodash',
  version: '4.17.20',
  ecosystem: 'npm',
  isDev: false,
  isTransitive: false,
};

describe('live OSV client', () => {
  it('maps live OSV data, CVSS vectors, and fixed versions', async () => {
    clearOsvCache();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          vulns: [
            {
              id: 'GHSA-test',
              aliases: ['CVE-2026-0001'],
              summary: 'Live vulnerability',
              severity: [
                {
                  type: 'CVSS_V3',
                  score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
                },
              ],
              affected: [
                {
                  package: { ecosystem: 'npm', name: 'lodash' },
                  ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '4.17.21' }] }],
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await queryLiveOsv([dependency], { fetchImpl, retries: 0 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.dependency).toEqual(dependency);
    expect(result[0]?.vulnerability.id).toBe('GHSA-test');
    expect(result[0]?.vulnerability.aliases).toEqual(['CVE-2026-0001']);
    expect(result[0]?.vulnerability.severity).toBe('critical');
    expect(result[0]?.vulnerability.cvssScore).toBe(9.8);
    expect(result[0]?.vulnerability.fixedVersions).toEqual(['4.17.21']);
  });

  it('retries bounded failures and caches successful responses', async () => {
    clearOsvCache();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue(new Response(JSON.stringify({ vulns: [] }), { status: 200 }));
    const sleep = vi.fn(() => Promise.resolve());

    await queryLiveOsv([dependency], { fetchImpl, retries: 1, sleep });
    await queryLiveOsv([dependency], { fetchImpl, retries: 1, sleep });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('expires cache entries and rejects bounded HTTP failures', async () => {
    clearOsvCache();
    let now = 1_000;
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ vulns: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ vulns: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }));

    await queryLiveOsv([dependency], { fetchImpl, cacheTtlMs: 10, now: () => now, retries: 0 });
    now += 11;
    await queryLiveOsv([dependency], { fetchImpl, cacheTtlMs: 10, now: () => now, retries: 0 });
    clearOsvCache();
    await expect(queryLiveOsv([dependency], { fetchImpl, retries: 0 })).rejects.toThrow(OsvError);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('uses database severity and details when CVSS and summary are absent', async () => {
    clearOsvCache();
    const packageDependency = { ...dependency, name: 'fixture-package', version: '1.0.0' };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          vulns: [
            {
              id: 'OSV-DETAILS',
              details: 'Detailed advisory',
              database_specific: { severity: 'MODERATE' },
              affected: [{ package: { ecosystem: 'npm', name: 'fixture-package' }, ranges: [] }],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await queryLiveOsv([packageDependency], { fetchImpl, retries: 0 });

    expect(result[0]?.vulnerability.summary).toBe('Detailed advisory');
    expect(result[0]?.vulnerability.severity).toBe('medium');
    expect(result[0]?.vulnerability.fixedVersions).toEqual([]);
  });

  it('deduplicates repeated lockfile packages and keeps the strongest scope', async () => {
    clearOsvCache();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ vulns: [] }), { status: 200 }));

    const result = await queryLiveOsv(
      [
        { ...dependency, isDev: true, isTransitive: true },
        { ...dependency, isDev: false, isTransitive: false },
      ],
      { fetchImpl, retries: 0 },
    );

    expect(result).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('CVSS assessment', () => {
  it('calculates standard CVSS v3.1 vectors deterministically', () => {
    expect(assessCvss('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toEqual({
      score: 9.8,
      severity: 'critical',
    });
    expect(assessCvss('5.4')).toEqual({ score: 5.4, severity: 'medium' });
    expect(assessCvss('not-cvss')).toEqual({ severity: 'unknown' });
    expect(assessCvss(undefined)).toEqual({ severity: 'unknown' });
    expect(assessCvss('CVSS:3.1/AV:N')).toEqual({ severity: 'unknown' });
    expect(assessCvss('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:N')).toEqual({
      score: 7.2,
      severity: 'high',
    });
  });
});
