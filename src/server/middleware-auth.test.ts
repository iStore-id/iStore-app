import assert from 'node:assert/strict';
import test from 'node:test';
import { isAdminRoleAllowed } from './middleware.js';

test('denies customer role even when its role record is active', () => {
  assert.equal(isAdminRoleAllowed('customer', 'ACTIVE', 'active'), false);
});

test('denies missing profile role or missing role record', () => {
  assert.equal(isAdminRoleAllowed(null, 'ACTIVE', 'active'), false);
  assert.equal(isAdminRoleAllowed('admin', 'ACTIVE', null), false);
});

test('denies inactive profile and inactive role', () => {
  assert.equal(isAdminRoleAllowed('admin', 'SUSPENDED', 'active'), false);
  assert.equal(isAdminRoleAllowed('admin', null, 'active'), false);
  assert.equal(isAdminRoleAllowed('admin', 'ACTIVE', 'inactive'), false);
});

test('allows an active admin or owner role regardless of status casing', () => {
  assert.equal(isAdminRoleAllowed('admin', 'ACTIVE', 'ACTIVE'), true);
  assert.equal(isAdminRoleAllowed('pemilik', 'active', 'active'), true);
});

test('allows an active custom staff role only when role record is active', () => {
  assert.equal(isAdminRoleAllowed('support_agent', 'active', 'active'), true);
  assert.equal(isAdminRoleAllowed('support_agent', 'active', 'inactive'), false);
});
