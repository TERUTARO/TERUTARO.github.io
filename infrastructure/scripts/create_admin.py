#!/usr/bin/env python3
"""Create an initial administrator, without sending mail or storing a password in state."""
import argparse
import json
import os
from pathlib import Path
import secrets
import string
import boto3
from write_runtime_config import outputs,ROOT

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ['outputs','username','credentials-file','allowed-account-id']:parser.add_argument('--'+key,required=True)
    args=parser.parse_args();config=outputs(args.outputs)
    destination=Path(args.credentials_file).resolve()
    if ROOT==destination or ROOT in destination.parents:parser.error('Credentials file must be outside the repository.')
    if destination.exists():parser.error('Refusing to overwrite an existing credentials file.')
    session=boto3.Session(region_name=config['region'])
    if session.client('sts').get_caller_identity()['Account']!=args.allowed_account_id:parser.error('AWS account does not match.')
    client=session.client('cognito-idp')
    try:
        client.admin_get_user(UserPoolId=config['user_pool_id'],Username=args.username)
    except client.exceptions.UserNotFoundException:pass
    else:parser.error('This administrator already exists; no password was changed.')
    password='A1!a'+''.join(secrets.choice(string.ascii_letters+string.digits+'!@#%+-_') for _ in range(28))
    destination.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    descriptor=os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'w') as f:
        f.write('管理画面: '+config['admin_url']+'\nID: '+args.username+'\n仮パスワード: '+password+'\n初回ログイン時に新しいパスワードを設定してください。\n')
        f.flush()
        os.fsync(f.fileno())
    # Preserve the temporary password even if user/group creation is interrupted.
    client.admin_create_user(UserPoolId=config['user_pool_id'],Username=args.username,TemporaryPassword=password,MessageAction='SUPPRESS')
    client.admin_add_user_to_group(UserPoolId=config['user_pool_id'],Username=args.username,GroupName='administrators')
    print('Administrator created; first login requires a new password. Credentials saved to '+str(destination))
if __name__=='__main__':main()
