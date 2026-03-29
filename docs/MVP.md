作ったプログラムだと抽出がうまくいかなかったからまたゼロからプロジェクトを作り直そうと思う。決まっているところは以下の通りなので合体させて作ってください。
データベース
documents
    id
    filename
    pdf_path
    title

lines
    id
    doc_id
    page_no
    line_no
    text
    x0, y0, x1, y1

paragraphs
    id
    doc_id
    order_index
    unit_type
    page_no
    start_line_id
    end_line_id
    heading_text
    raw_text
    normalized_text

sentences
    id
    paragraph_id
    sentence_index
    source_text
    translated_text

figures
    id
    doc_id
    fig_no
    page_no
    image_bbox
    caption_bbox
    caption_text
    image_path

sentence_figure_refs
    id
    sentence_id
    figure_id
    ref_label
    ref_text
    order_index

操作フロー
ユーザーがPDFをアップロード
PDFページを表示
最初に title と summary/abstract を手動指定
最初の paragraph を指定
その paragraph について
paragraph title
paragraph body
を別で保存
その paragraph を読む
読み終わったら次の paragraph を指定
これをループ
文中に FIG 参照が出たら、必要に応じて
FIG本体の範囲
caption（注釈）
をPDF上で手動指定

文分割はspaCyを使用します。DeepL　APIで翻訳します。左ペインはパラグラフごとに読み込んで文ごとに英語と日本語の翻訳を交互に表示してください。右ペインは上側に抽出した図表を表示してください。下側はキャプションを表示してください。図表、キャプションは今の段階では手動でスクロールしていける感じで大丈夫です。