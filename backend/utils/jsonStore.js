/**
 * Tiny JSON-file "database" layer.
 *
 * Every function here mirrors what a real DB call would look like
 * (readAll, insert, update, remove) so that when this system is moved to
 * MySQL/Postgres, only this file needs to change — routes call these
 * functions and never touch the filesystem directly.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function filePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function readAll(collection) {
  const file = filePath(collection);
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf-8").trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeAll(collection, records) {
  const file = filePath(collection);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(records, null, 2), "utf-8");
}

function insert(collection, record) {
  const records = readAll(collection);
  const nextId =
    records.length > 0 ? Math.max(...records.map((r) => r.id)) + 1 : 1;
  const newRecord = { id: nextId, ...record };
  records.push(newRecord);
  writeAll(collection, records);
  return newRecord;
}

function findById(collection, id) {
  const records = readAll(collection);
  return records.find((r) => r.id === Number(id));
}

function update(collection, id, changes) {
  const records = readAll(collection);
  const index = records.findIndex((r) => r.id === Number(id));
  if (index === -1) return null;
  records[index] = { ...records[index], ...changes };
  writeAll(collection, records);
  return records[index];
}

function remove(collection, id) {
  const records = readAll(collection);
  const filtered = records.filter((r) => r.id !== Number(id));
  writeAll(collection, filtered);
  return filtered.length !== records.length;
}

module.exports = { readAll, writeAll, insert, findById, update, remove };
