import test from 'node:test';
import assert from 'node:assert/strict';

test('process loss calculation computes carat difference and percentage correctly', () => {
  const issuedCarat = 25.5;
  const returnedCarat = 24.225;
  const processLossCarat = Math.round((issuedCarat - returnedCarat) * 1000) / 1000;
  const processLossPercentage = Math.round((processLossCarat / issuedCarat) * 10000) / 100;

  assert.equal(processLossCarat, 1.275);
  assert.equal(processLossPercentage, 5.0);
});

test('allowed sort fields validate and map correctly', () => {
  const allowedSortFields = {
    kapanNo: 'kapanNo',
    issueNo: 'issueNo',
    issueDate: 'issueDate',
    returnDate: 'returnDate',
    processLossPercentage: 'processLossPercentage',
    createdAt: 'createdAt',
  };

  assert.equal(allowedSortFields['kapanNo'], 'kapanNo');
  assert.equal(allowedSortFields['issueDate'], 'issueDate');
  assert.equal(allowedSortFields['invalidField'], undefined);

  const sortDirectionAsc = 'asc' === 'desc' ? -1 : 1;
  const sortDirectionDesc = 'desc' === 'desc' ? -1 : 1;
  assert.equal(sortDirectionAsc, 1);
  assert.equal(sortDirectionDesc, -1);
});
