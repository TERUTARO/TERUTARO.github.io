#!/usr/bin/env python3
"""Write non-secret public/admin settings from terraform output -json."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit
ROOT = Path(__file__).resolve().parents[2]
def outputs(path):
    raw=json.loads(Path(path).read_text())
    result={key:value['value'] for key,value in raw.items()}
    url=urlsplit(result['api_base_url'])
    if url.scheme!='https' or not url.hostname or not url.hostname.endswith('.amazonaws.com'):
        raise ValueError('Unexpected API URL in Terraform outputs')
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--outputs',required=True);args=parser.parse_args()
    config=outputs(args.outputs)
    public=ROOT/'frontend/public'
    (public/'assets/runtime-config.json').write_text(json.dumps({'apiBaseUrl':config['api_base_url']},indent=2)+'\n')
    (public/'admin-config.json').write_text(json.dumps({'apiBaseUrl':config['api_base_url'],'region':config['region'],'userPoolId':config['user_pool_id'],'clientId':config['user_pool_client_id']},indent=2)+'\n')
    print('Non-secret runtime configuration written. Admin config is excluded from Git.')
if __name__=='__main__':main()
