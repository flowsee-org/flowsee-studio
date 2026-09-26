import json

data = json.load(open('.local/db.json'))

target_emails = ['bariran.ramtin@gmail.com', 'ivcharon92@gmail.com']
target_ids = []
for u in data['users']:
    if u['email'] in target_emails:
        target_ids.append(u['id'])
        print('FOUND USER:', u['id'], u['email'])

print('TARGET IDS:', target_ids)

# Remove users
data['users'] = [u for u in data['users'] if u['email'] not in target_emails]

# Remove references from entities
for ename, recs in data['entities'].items():
    if isinstance(recs, list):
        new_recs = []
        for r in recs:
            if isinstance(r, dict):
                refs = False
                for v in r.values():
                    if isinstance(v, str):
                        if any(tid in v for tid in target_ids):
                            refs = True
                        if any(te in v for te in target_emails):
                            refs = True
                    elif isinstance(v, list):
                        if any(isinstance(item, str) and any(tid in item for tid in target_ids) for item in v):
                            refs = True
                        if any(isinstance(item, str) and any(te in item for te in target_emails) for item in v):
                            refs = True
                if not refs:
                    new_recs.append(r)
            else:
                new_recs.append(r)
        if len(new_recs) != len(recs):
            print(f'  {ename}: removed {len(recs) - len(new_recs)} records')
        data['entities'][ename] = new_recs

with open('.local/db.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('DONE - db.json cleaned')