# プロフィールアイコンの編集記録

- 出力: `assets/portrait.png`（1254 × 1254、RGBA、背景透過）
- 方法: built-in `image_gen` による写真編集。CLI/APIフォールバックは未使用。
- 入力: 本人が提供し、個人ページのアイコンへの使用を依頼した写真。
- 確認: 表示とアルファチャンネルを確認。生成系の編集のため、元写真の画素を完全に保持した切り抜きではない。

## 最終プロンプト

```text
Use case: background-extraction.
Asset type: transparent photographic personal profile icon for a portfolio website.
Input image 1 is the edit target, an original photograph supplied by the person pictured.
Primary request: faithfully cut out ONLY the foreground man from this exact photograph. Remove the café interior, furniture, glassware, walls and all other background pixels completely.
Composition/framing: square PNG, tightly composed head-and-shoulders portrait from the full top of his hair to his shoulders and upper chest. Center the portrait with a small amount of clear margin around the hair and shoulders. The shoulder/upper-chest crop can meet the bottom of the square. Keep his existing head turned to the viewer's right and his existing pose.
Scene/backdrop: actual fully transparent alpha background. All space outside the extracted person must be transparent.
Constraints: preserve the ORIGINAL person's facial features, facial proportions, asymmetry, hair silhouette and loose strands, expression, gaze direction, skin texture, stubble, black coat, brown shearling collar, tan shirt, and original warm natural photographic lighting. This is an extraction of the existing photograph, not a new portrait. Do not reconstruct, beautify, smooth skin, change age, restyle, relight, illustrate, or add anything. Refine the existing hair and clothing edges naturally without white halos. No frame, circle, border, drop shadow, text, watermark, white background, colored background, or checkerboard pattern. Output a high-detail PNG with a real alpha channel.
```
