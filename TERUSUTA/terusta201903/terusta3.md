# Apache
## Apacheのインストール
1.以下のコマンドを実行し、Apacheをインストールする。

```bash
yum install httpd
```

2.以下のコマンドを実行し、インストールされたことを確認する。

```bash
yum list installed | grep httpd
httpd --version 
```

## Apacheの起動
1.以下のコマンドを実行する。
```bash
systemctl start httpd
```

2.以下のコマンドを実行し、サービスの起動状態を確認する。
```bash
systemctl status httpd
```

## httpd.confの設定／確認
1.以下のコマンドを実行し、カレントディレクトリを移動し、ディレクトリ配下を確認する。
```bash
cd /var/httpd/conf/
ls -lha 
```

2.以下のコマンドを実行し、設定ファイルのバックアップを取得する。
```bash
mkdir Config-Backup
cp -a ./httpd.conf ./Config-Backup/httpd.conf.orig
ls -lha ./Config-Backup
```

3.以下のコマンドを実行し、設定ファイルの以下の内容を設定／保存する。
```bash
vi httpd.conf
```

*設定項目*

| 設定項目	| 設定値 	|
| :--		| :--  		|
| ServerName    | FQDN          |


4.以下のコマンドを実行する。
```bash
systemctl restart httpd
systemctl status httpd
```

5.ブラウザから設定FQDNにアクセスする。
　Apacheの初期設定ページが表示されることを確認する。

# MySQL
## MySQLの導入
1.以下のコマンドを実行し、MySQLを導入する。

```bash
yum install mysql-server
```

2.以下のコマンドを実行し、導入されたことを確認する。
```bash
yum list installed | grep mysqld
mysqld --version
```

## MySQLの起動
1.以下のコマンドを実行する。
```bash
systemctl start mysqld
```

## MySQLの設定
1.以下のコマンドを実行し、MySQLに接続する。
```bash
mysql -u root -p
```

2.MySQLに接続される。
以下のコマンドを実行し、初期登録データベースを確認する。　
```bash
show databases;
``` 

3.以下のコマンドを実行し、データベース／テーブルを作成する。
```bash
create database test;

use test;

CREATE TABLE name (
id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
name TEXT NOT NULL
)DEFAULT CHARACTER SET=utf8;
```

4.以下のコマンドを実行し、登録カラム情報を確認する。





5.以下のコマンドを実行し、MySQLからexitする。

```bash
quit
```


# PHP
## PHPの導入
1.以下のコマンドを実行し、phpを導入する。

```bash
yum install php 
```

2.以下のコマンドを実行し、導入されたことを確認する。
```bash 
php --version 
```

## PHPのモジュールの導入
1.以下のコマンドを実行し、phpモジュールを導入する。

```bash
yum install php-mysqli php-pdo
```

2.以下のコマンドを実行し、導入することを確認する。
```bash
yum list installed | grep php
```


# git
## gitの導入
1.以下のコマンドを実行しgitを導入する。
```bash
yum install git
```

2.以下のコマンドを実行し、導入されたことを確認する。
```bash
git --version
```

## ローカルリポジトリの作成

1.カレントディレクトリを移動し、ローカルリポジトリを作成する。
```bash
cd /var/www/html
pwd
git init

```

## リモートリポジトリの追加
1.以下のコマンドを実行する。

```bash
git remote add origin https://github.com/TERUTARO/terusta201903.git
```
## リモートリポジトリからのPULL
1.以下のコマンドを実行し、リモートリポジトリをPULLしてくる。

```bash
git pull origin master
pwd
```
以下のコマンドを実行する。


# htmlファイルの編集
1.以下のコマンドを実行すせい、viエディタでhtmlファイルを開く。

```bash
vi sample.html
```

2.「コーデイング箇所」内に以下の内容を追記し、内容を保存して閉じる。

```html
<form class = "input_form" action="dbcon.php" method="post">
        Please Input Your Name：<input type="text" name="yourname">
	<input type="submit" value="登録する">
</form>
```

# phpファイルの編集
1.以下のコマンドを実行する。

```bash
vi dbcon.php
```

2.「コーディング箇所 2 」内に以下の内容を追記し、内容を保存して閉じる。

*追記前*

```php
$db_host = "";
$db_user = "";
$db_pass = "";
$db_name = "";
```

*追記後*
```php
$db_host = "localhost";
$db_user = "root";
$db_pass = "";
$db_name = "test";
```

3.「コーディング箇所 3」内に以下の内容を追記し、内容を保存して閉じる。
```PHP
$stmt = $mysqli->prepare("INSERT INTO name (name) VALUES (?)");
```

























　





