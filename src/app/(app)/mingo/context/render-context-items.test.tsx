import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONTEXT_ENTITY_KIND } from './context-types';
import { SoftwareItems, VulnerabilityItems } from './relay-items';
import { renderMingoContextItems } from './render-context-items';

vi.mock('./relay-items', () => ({
  DeviceItems: vi.fn(),
  IncidentItems: vi.fn(),
  KnowledgeBaseItems: vi.fn(),
  OrganizationItems: vi.fn(),
  ScheduleItems: vi.fn(),
  ScriptItems: vi.fn(),
  SoftwareItems: vi.fn(),
  VulnerabilityItems: vi.fn(),
}));

describe('Mingo context item sources', () => {
  it.each([
    [CONTEXT_ENTITY_KIND.SOFTWARE, SoftwareItems],
    [CONTEXT_ENTITY_KIND.VULNERABILITY, VulnerabilityItems],
  ])('routes %s picker entries to their source component', (type, component) => {
    const selectedKeys = new Set<string>();
    const onToggle = vi.fn();
    const element = renderMingoContextItems({ type, query: 'security', selectedKeys, onToggle, atLimit: false });

    expect(isValidElement(element)).toBe(true);
    if (!isValidElement(element)) return;
    expect(element.type).toBe(component);
    expect(element.key).toBe(type);
    expect(element.props).toEqual({ query: 'security', selectedKeys, onToggle, atLimit: false });
  });
});
