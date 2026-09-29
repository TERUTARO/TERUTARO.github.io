#JavaScriptあんまり使ったことのないやつが送るJavasciript

#スライダーを自作するよ
<img src= "img/slider.jpg">
　


##HTMLファイルの準備
1.以下の名称でファイルを任意のフォルダ配下に作成する。

*demo.html*

2.demo.htmlをテキストエディタで開き、以下をコピペする。
```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>Slider</title>
<style type="text/css">
  /* スタイルシート */
</style>
<script src="jquery-1.11.3.min.js"></script>
</head>
<body>

<!-- HTML -->
<div class="slider">
  <div class="slideSet">
    <div class="slide">slide1</div>
    <div class="slide">slide2</div>
    <div class="slide">slide3</div>
    <div class="slide">slide4</div>
    <div class="slide">slide5</div>
  </div>
</div>

<!-- js -->
<script>
</script>

</body>
</html>
```

※今回はハンズオン中のミス防止のためスタイルシート等の分離はしません。

3.編集が完了したら保存してブラウザで表示してみましょう。以下のように表示されていればOKです！

[リンクはこちら](demo/demo-01.html)



##css追記 --- divの直線配置とoverflowによる収納 ---

1.css部分に以下を追記する。

*追記部分*
```css
.slider .slide {
  width: 498px;
  height: 198px;
  border: 1px solid #f00;
  float: left;
}
```

*全体像*

```html　
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>Slider</title>
<style type="text/css">
  /* スタイルシート */
  .slider .slide {
    width: 498px;
    height: 198px;
    border: 1px solid #f00;
    float: left;
  }
</style>
<script src="jquery-1.11.3.min.js"></script>
</head>
<body>

<!-- HTML -->
<div class="slider">
  <div class="slideSet">
    <div class="slide">slide1</div>
    <div class="slide">slide2</div>
    <div class="slide">slide3</div>
    <div class="slide">slide4</div>
    <div class="slide">slide5</div>
  </div>
</div>

<!-- js -->
<script>
</script>

```

2.編集が完了したら保存してブラウザで表示してみましょう。以下のように表示されていればOKです！

[リンクはこちら](demo/demo-02.html)


3.スライダーはフィルムのようにコンテンツを直線上に並べておく必要がある。
上記のリンクではいくつかのdivがカラム落ちしているはず。（多分。。。）

ですので、それを防ぐよう努力します。以下をcssに追記する。

```css
.slider .slideSet {
  width: 2500px;
}
```

追記後、保存して以下のように表示されていればうまくいってる。

[リンクはこちら](demo/demo-03.html)


4.次に、直線状に並べたコンテンツに対し、見えるコンテンツを限定する。
以下をcssに追記する。

```css
.slider {
  width: 500px;
  height: 200px;
  overflow: hidden;
}

```

追記後、保存して以下のように表示されていればうまくいってる。

[リンクはこちら](demo/demo-04.html)


ここまでJSの話なし！

<img src= "img/komakeekotaindayo.jpg">

[NEXT](Javascript-03.html)

[PREVIOUS](Javascript-01.html)
