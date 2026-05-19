Stock Orders

- These do not have a sales order to link to a work order

- They could be in the queue for multiple production runs

- They do have a work order to import from

Non-Production Orders

- These will have a sales order but no work order

- They are usually Raw, unprocessed material

- Thes will most likely be processed at one time without a production run

Unproduce?

# At work - export
npm run export:seed

# At home - load
mysql -u root -p pands < db/schema.sql      # only needed once / after pulling new migrations
mysql -u root -p pands < db/seed-export.sql
