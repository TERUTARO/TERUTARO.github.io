#JavaScriptあんまり使ったことのないやつが送るJavasciript

#スライダーを自作するよ　

##jQueryとは
Javascriptのライブラリです。

##jQueryの準備

1.以下のページにアクセス

http://jquery.com/download/

2.「Download the compressed, production jQuery 3.3.1」をDL。

3.DLできなかった場合は「Download the uncompressed, development jQuery 3.3.1」の方をクリック。
表示された内容を全て選択し、コピー。demo.htmlと同一のディレクトリに「jquery-1.11.3.min.js」という名称で保存してください。


## js追記 --- 幅を自動計算する ---
1.script部分に以下を追記する。

```Javascript
var slideWidth = $('.slide').outerWidth();
var slideNum = $('.slide').length;

```

ここで、上記記述のJavaScriptの記法について説明する。

+ var ... 変数宣言
+ outerWidth ... 要素の幅
+ length ... 要素長／要素数
　

※ここで、lengthには()がついていないが、これはlengthがメソッドでなくプロパティだからである。

　
2.script部分に以下を追記する。

```Javascript
var slideSetWidth = slideWidth * slideNum;
$('.slideSet').css('width', slideSetWidth);

```

slideSetWidthで新たに規定しているのは取得してきた
slideWidthとslideの乗算である。
これでcssに指定した以下の定義と代替可能であり、さらに幅は自動計算で取得代入ができる。

3.cssの以下の項目を削除する。

```css
.slideSet {
  width: 2500px; /* 削除 */
}

```

4.編集後、保存してブラウザで確認。以下のように表示されていればうまくいっている。

[リンクはこちら](demo/demo-06.html)



##js追記 --- スライドアニメーションを追加する ---
jsはどのようにアニメーション表現を実現しているのか？
それはスタイルシートを連続更新して実現している。そのような動きをjQueryなら
簡単に表現できる。

1.scripts項目に以下を追記する。
```Javascript
$('.slideSet').animate({
  left: -slideWidth
});
```

2.ポジション調整のためにcssに以下を追記
```css
.slider {
  width: 500px;
  height: 200px;
  overflow: hidden;
  position: relative; /*これを追記  */
}

.slider .slideSet {
  position: absolute;　/* これを追記 */
}

```

3.編集後、保存してブラウザで確認してみよう。以下のようにちょろっと動けばうまくいっている。

[リンクはこちら](demo/demo-07.html)

slideにいかねえ。。。！


##js追記 --- 位置計算 ---
sliderの位置はslide番号とslide幅の乗算であらわすことが可能。また、
最初の位置がleft:0であることに注意。

進む／戻るボタンを作成して、押下されると+1進む／戻る仕様に。

1.以下をhtmlに追記。
```html
<div class="slider">
  <div class="slideSet">
    <div class="slide">slide1</div>
    <div class="slide">slide2</div>
    <div class="slide">slide3</div>
    <div class="slide">slide4</div>
    <div class="slide">slide5</div>
  </div>
</div>
<button class="slider-prev">前へ</button>　<!-- これを追記 -->
<button class="slider-next">次へ</button>　<!-- これを追記 -->

```

2.以下をscript部を以下のように修正する。
```Javascript

var slideWidth = $('.slide').outerWidth();
var slideNum = $('.slide').length;
var slideSetWidth = slideWidth * slideNum;
$('.slideSet').css('width', slideSetWidth);

var slideCurrent = 0;	// 追記箇所。

//修正箇所。関数として宣言
var sliding = function(){
	$('.slideSet').animate({
		left: slideCurrent * -slideWidth
	});
}

//追記箇所 前へボタンが押されたとき
$('.slider-prev').click(function(){
	slideCurrent--;
	sliding();
});

//追記箇所 次へボタンが押されたとき
$('.slider-next').click(function(){
	slideCurrent++;
	sliding();
});

```

ここで、上記記述のJavaScriptの記法について説明する。

+ var slideCurrent ... ここで、現在地を0にイニシャライズする。
+ var sliding = function() ...アニメーション部分を関数化することにより、後述のクリック処理で使いまわせる。
+ .click(){} ... ｛｝内には、クリック時に実行したいイベントを指定する。



3.編集後、保存してブラウザで確認してみよう。ボタンをクリックしてポコポコ動けばOK。

[リンクはこちら](demo/demo-08.html)



##slideを周回させる。
slide5まで到達した際に、また1からスタートさせるとより満足できる。
宣言した関数上で条件分岐してやればよい。



1.script部の以下を修正する。
```
var sliding = function(){

  // slideCurrentが0以下だったら
  if( slideCurrent < 0 ){
    slideCurrent = slideNum - 1;

  // slideCurrentがslideNumを超えたら
  }else if( slideCurrent > slideNum - 1){ // slideCUrrent >= slideNumでも可
    slideCurrent = 0;
  }
```

2.編集後、保存してブラウザで確認してみよう。ボタンをクリックしてポコポコ動けばOK。

[リンクはこちら](demo/demo-09.html)

[PREVIOUS](Javascript-02.html)
