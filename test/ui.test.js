import test from 'node:test';
import assert from 'node:assert/strict';
import { mapDbError } from '../js/ui.js';

test('mapDbError translates common Postgres/Supabase errors to Korean', () => {
  assert.equal(mapDbError({ code: '23505', message: 'duplicate key' }), '이미 등록된 항목입니다 (중복)');
  assert.equal(mapDbError({ code: '23503', message: 'fk' }), '연결된 데이터가 있어 처리할 수 없습니다');
  assert.equal(mapDbError({ code: '23514', message: 'check' }), '허용되지 않는 값입니다 (예: 음수, 월요일이 아닌 주차)');
  assert.equal(mapDbError({ code: '42501', message: 'permission denied' }), '권한이 없습니다. 다시 로그인하세요');
  assert.equal(mapDbError({ status: 401, message: 'JWT expired' }), '권한이 없습니다. 다시 로그인하세요');
  assert.equal(mapDbError({ message: 'something odd' }), '요청에 실패했습니다: something odd');
  assert.equal(mapDbError(null), '요청에 실패했습니다');
});
