#!/usr/bin/env python3
"""Upload only the admin export and its Next.js assets to private S3."""
import argparse
import json
import mimetypes
import time
from pathlib import Path
import boto3
from write_runtime_config import outputs,ROOT

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--outputs',required=True);parser.add_argument('--directory',default=str(ROOT/'frontend/out'));parser.add_argument('--allowed-account-id',required=True);args=parser.parse_args()
    config=outputs(args.outputs);directory=Path(args.directory).resolve()
    session=boto3.Session(region_name=config['region'])
    if session.client('sts').get_caller_identity()['Account']!=args.allowed_account_id:parser.error('AWS account does not match.')
    html=directory/'admin.html';setting=ROOT/'frontend/public/admin-config.json'
    if not html.is_file() or not setting.is_file():parser.error('Build the admin page and write runtime configuration first.')
    admin=json.loads(setting.read_text())
    expected={'apiBaseUrl':config['api_base_url'],'clientId':config['user_pool_client_id'],'region':config['region'],'userPoolId':config['user_pool_id']}
    if any(admin.get(key)!=value for key,value in expected.items()):parser.error('Admin configuration does not match Terraform outputs.')
    client=session.client('s3');bucket=config['admin_bucket_name'];client.head_bucket(Bucket=bucket,ExpectedBucketOwner=args.allowed_account_id)
    assets=[(p,p.relative_to(directory).as_posix()) for p in (directory/'_next/static').rglob('*') if p.is_file()]
    assets += [(setting,'admin-config.json'),(html,'admin.html')]
    for source,key in assets:
        content_type=mimetypes.guess_type(key)[0] or 'application/octet-stream'
        client.put_object(Bucket=bucket,Key=key,Body=source.read_bytes(),ContentType=content_type,CacheControl='public,max-age=31536000,immutable' if key.startswith('_next/static/') else 'no-store',ExpectedBucketOwner=args.allowed_account_id)
    session.client('cloudfront').create_invalidation(DistributionId=config['admin_distribution_id'],InvalidationBatch={'Paths':{'Quantity':3,'Items':['/','/admin.html','/admin-config.json']},'CallerReference':'admin-'+str(time.time_ns())})
    print(f'Uploaded {len(assets)} files. Admin URL: '+config['admin_url'])
if __name__=='__main__':main()
