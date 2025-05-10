const mongoose = require('mongoose');
const { Types } = mongoose;
const importedModel = require('../models/manga.model');

// モデルを正しく取得（ESModuleからCommonJSへの変換に対応）
const MangaModel = importedModel.default || importedModel;

// モデルが正しくロードされたかを確認するためのデバッグログ
console.log('読み込まれたMangaモデル:', {
  型: typeof MangaModel,
  名前: MangaModel?.modelName,
  Mongooseモデルかどうか: MangaModel instanceof mongoose.Model,
  メソッド: Object.keys(MangaModel || {})
});

// 漫画データを保存する
exports.saveManga = async (req, res) => {
  try {
    console.log('saveManga関数が呼び出されました');
    const mangaData = req.body;
    
    // Mangaモデルが適切にロードされているか確認
    if (!MangaModel || typeof MangaModel.findOne !== 'function') {
      console.error('Mangaモデルが正しくロードされていません:', MangaModel);
      return res.status(500).json({ error: 'データベースモデルエラー' });
    }
    
    // 既存のデータをfanzaIdで検索
    let manga = await MangaModel.findOne({ fanzaId: mangaData.fanzaId });
    
    if (manga) {
      // 既存のデータを更新
      Object.assign(manga, mangaData);
      manga = await manga.save();
      return res.status(200).json(manga);
    } else {
      // 新規作成
      const newManga = new MangaModel(mangaData);
      await newManga.save();
      return res.status(201).json(newManga);
    }
  } catch (error) {
    console.error('MongoDB保存エラー:', error);
    return res.status(500).json({ error: error.message });
  }
};

// キーワードで検索
exports.searchByKeywords = async (req, res) => {
  try {
    console.log('searchByKeywords関数が呼び出されました');
    const { keywords } = req.body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'キーワードは必須です' });
    }
    
    // Mangaモデルが適切にロードされているか確認
    if (!MangaModel || typeof MangaModel.find !== 'function') {
      console.error('Mangaモデルが正しくロードされていません:', MangaModel);
      return res.status(500).json({ error: 'データベースモデルエラー' });
    }
    
    const manga = await MangaModel.find({
      searchKeywords: { $in: keywords.map(k => k.toLowerCase()) }
    }).sort({ updatedAt: -1 });

    // 取得したデータをログに表示
    console.log('取得した漫画データ:', manga);
    
    return res.status(200).json(manga);
  } catch (error) {
    console.error('検索エラー:', error);
    return res.status(500).json({ error: error.message });
  }
};

// 組み合わせで検索
exports.searchByCombination = async (req, res) => {
  try {
    console.log('searchByCombination関数が呼び出されました');
    const { combination } = req.body;
    
    if (!combination || !Array.isArray(combination) || combination.length === 0) {
      return res.status(400).json({ error: '組み合わせは必須です' });
    }
    
    // Mangaモデルが適切にロードされているか確認
    if (!MangaModel || typeof MangaModel.find !== 'function') {
      console.error('Mangaモデルが正しくロードされていません:', MangaModel);
      return res.status(500).json({ error: 'データベースモデルエラー' });
    }
    
    // 完全一致の組み合わせを検索
    const manga = await MangaModel.find({
      combinations: { $in: combination }
    }).sort({ updatedAt: -1 });

    // 取得したデータをログに表示
    console.log('取得した漫画データ:', manga);
    
    return res.status(200).json(manga);
  } catch (error) {
    console.error('組み合わせ検索エラー:', error);
    return res.status(500).json({ error: error.message });
  }
};

// タグまたは作者で検索
exports.searchByTagsOrAuthor = async (req, res) => {
  try {
    console.log('searchByTagsOrAuthor関数が呼び出されました:', req.query);
    const { query, lastId, lastUpdatedAt, limit = 20 } = req.query;
    
    // Mongooseの接続状態を確認
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      console.error('MongoDB接続が確立されていません。状態:', mongoose.connection ? mongoose.connection.readyState : 'undefined');
      return res.status(500).json({ error: 'データベース接続エラー' });
    }
    
    // Mangaモデルが適切にロードされているか確認
    if (!MangaModel || typeof MangaModel.find !== 'function') {
      console.error('Mangaモデルが正しくロードされていません:', MangaModel);
      return res.status(500).json({ error: 'データベースモデルエラー' });
    }
    
    console.log('クエリパラメータ:', query, 'lastId:', lastId, 'lastUpdatedAt:', lastUpdatedAt);
    
    // クエリ条件の構築
    const queryConditions = {};
    
    // カーソルベースページングの条件
    if (lastId && lastUpdatedAt) {
      queryConditions.$or = [
        { updatedAt: { $lt: new Date(lastUpdatedAt) } },
        { updatedAt: new Date(lastUpdatedAt), _id: { $lt: new Types.ObjectId(String(lastId)) } }
      ];
    }
    
    if (query) {
      // 検索クエリが指定されている場合
      console.log('元の検索クエリ:', query);
      
      // クエリを分解して検索条件を構築
      let searchTerms = [];
      
      // 「サイト名+作品名」の形式を処理
      if (query.includes('+')) {
        // +で分割して各部分で検索
        searchTerms = query.split('+').map(term => term.trim()).filter(term => term);
        console.log('「+」で分割した検索用語:', searchTerms);
      } else {
        // 空白で分割して各部分で検索
        searchTerms = query.split(/\s+/).filter(term => term);
        console.log('空白で分割した検索用語:', searchTerms);
        
        // 元のクエリも検索用語として追加
        if (!searchTerms.includes(query)) {
          searchTerms.push(query);
        }
      }
      
      // 各検索用語に対して条件を作成
      const searchConditions = {
        $or: []
      };
      
      // 完全一致の検索条件（元のクエリをそのまま使用）
      searchConditions.$or.push(
        { tags: { $regex: query, $options: 'i' } },
        { author: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } }
      );
      
      // 分解した検索用語の条件を追加
      for (const term of searchTerms) {
        if (term.length >= 2) { // 2文字以上の用語のみ検索に使用
          searchConditions.$or.push(
            { tags: { $regex: term, $options: 'i' } },
            { author: { $regex: term, $options: 'i' } },
            { title: { $regex: term, $options: 'i' } }
          );
        }
      }
      
      // 検索条件とカーソル条件を組み合わせる
      if (queryConditions.$or) {
        queryConditions.$and = [searchConditions, { $or: queryConditions.$or }];
        delete queryConditions.$or;
      } else {
        Object.assign(queryConditions, searchConditions);
      }
    }
    
    console.log('最終的なクエリ条件:', JSON.stringify(queryConditions));
    
    // データ取得
    const manga = await MangaModel.find(queryConditions)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(parseInt(limit));
    
    // 取得したデータをログに表示
    console.log(`検索結果: ${manga.length}件`);
    if (manga.length > 0) {
      console.log('最初の検索結果:', manga[0].title);
    }
    
    // 次のページの情報を含めてレスポンスを返す
    if (manga.length === 0) {
      // 検索結果が0件の場合、404ではなく200で空のデータを返す
      return res.status(200).json({
        data: [],
        nextCursor: null,
        hasMore: false,
        message: '漫画データが見つかりませんでした。検索条件を変更するか、後でもう一度お試しください。'
      });
    }
    
    // 次のページのカーソル情報
    const lastItem = manga[manga.length - 1];
    const nextCursor = {
      lastId: lastItem._id.toString(),
      lastUpdatedAt: lastItem.updatedAt.toISOString()
    };
    
    return res.status(200).json({
      data: manga,
      nextCursor: nextCursor,
      hasMore: manga.length === parseInt(limit)
    });
  } catch (error) {
    console.error('タグ・作者検索エラー:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// すべての組み合わせを取得
exports.getAllCombinations = async (req, res) => {
  try {
    console.log('getAllCombinations関数が呼び出されました');
    // Mangaモデルが適切にロードされているか確認
    if (!MangaModel || typeof MangaModel.aggregate !== 'function') {
      console.error('Mangaモデルが正しくロードされていません:', MangaModel);
      return res.status(500).json({ error: 'データベースモデルエラー' });
    }
    
    // ユニークな組み合わせを集計
    const result = await MangaModel.aggregate([
      { $unwind: '$combinations' },
      { $group: { _id: '$combinations' } },
      { $project: { _id: 0, combination: '$_id' } }
    ]);
    
    return res.status(200).json(result.map(item => item.combination));
  } catch (error) {
    console.error('組み合わせ取得エラー:', error);
    return res.status(500).json({ error: error.message });
  }
};

// 人気の組み合わせを取得
exports.getPopularCombinations = async (req, res) => {
  try {
    console.log('getPopularCombinations関数が呼び出されました');
    const limit = parseInt(req.query.limit) || 10;
    
    // Mangaモデルが適切にロードされているか確認
    if (!MangaModel || typeof MangaModel.aggregate !== 'function') {
      console.error('Mangaモデルが正しくロードされていません:', MangaModel);
      return res.status(500).json({ error: 'データベースモデルエラー' });
    }
    
    // 組み合わせの出現回数を集計
    const result = await MangaModel.aggregate([
      { $unwind: '$combinations' },
      { $group: { 
        _id: '$combinations', 
        count: { $sum: 1 } 
      }},
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { 
        _id: 0, 
        combination: '$_id', 
        count: 1 
      }}
    ]);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('人気組み合わせ取得エラー:', error);
    return res.status(500).json({ error: error.message });
  }
};

// バルクインポート
exports.bulkImport = async (req, res) => {
  try {
    console.log('bulkImport関数が呼び出されました');
    const { mangas } = req.body;
    
    if (!mangas || !Array.isArray(mangas) || mangas.length === 0) {
      return res.status(400).json({ error: 'データは必須です' });
    }
    
    // Mangaモデルが適切にロードされているか確認
    if (!MangaModel || typeof MangaModel.bulkWrite !== 'function') {
      console.error('Mangaモデルが正しくロードされていません:', MangaModel);
      return res.status(500).json({ error: 'データベースモデルエラー' });
    }
    
    const operations = mangas.map(manga => ({
      updateOne: {
        filter: { fanzaId: manga.fanzaId },
        update: { $set: manga },
        upsert: true
      }
    }));
    
    const result = await MangaModel.bulkWrite(operations);
    
    return res.status(200).json({
      message: 'バルクインポート完了',
      result: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      }
    });
  } catch (error) {
    console.error('バルクインポートエラー:', error);
    return res.status(500).json({ error: error.message });
  }
};

// IDで漫画を取得
exports.getMangaById = async (req, res) => {
  try {
    console.log('getMangaById関数が呼び出されました:', req.params);
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'IDは必須です' });
    }
    
    // デバッグのためにIDの形式を表示
    console.log('取得しようとしているID:', id, 'タイプ:', typeof id);
    
    // Mangaモデルが適切にロードされているか確認
    if (!MangaModel || typeof MangaModel.findOne !== 'function') {
      console.error('Mangaモデルが正しくロードされていません:', MangaModel);
      return res.status(500).json({ error: 'データベースモデルエラー' });
    }
    
    // タイトルまたはfanzaIdで検索
    const manga = await MangaModel.findOne({ 
      $or: [
        { fanzaId: id },
        { title: { $regex: id, $options: 'i' } }
      ]
    });
    
    if (!manga) {
      console.log(`ID:${id}の漫画が見つかりませんでした`);
      return res.status(404).json({ error: '漫画が見つかりません' });
    }
    
    console.log(`ID:${id}の漫画が見つかりました:`, manga.title);
    return res.status(200).json(manga);
  } catch (error) {
    console.error('漫画取得エラー:', error);
    return res.status(500).json({ error: error.message });
  }
};

// レコメンドされた漫画を取得
exports.getRecommendations = async (req, res) => {
  try {
    console.log('getRecommendations関数が呼び出されました');
    const { 
      genres = [], 
      tags = [], 
      authors = [],
      excludeIds = [],
      lastId,
      lastUpdatedAt,
      limit = 20
    } = req.query;
    
    // クエリパラメータの配列処理
    const genreArr = Array.isArray(genres) ? genres : genres ? [genres] : [];
    const tagsArr = Array.isArray(tags) ? tags : tags ? [tags] : [];
    const authorsArr = Array.isArray(authors) ? authors : authors ? [authors] : [];
    const excludeIdsArr = Array.isArray(excludeIds) ? excludeIds : excludeIds ? [excludeIds] : [];
    
    // Mangaモデルが適切にロードされているか確認
    if (!MangaModel || typeof MangaModel.aggregate !== 'function') {
      console.error('Mangaモデルが正しくロードされていません:', MangaModel);
      return res.status(500).json({ error: 'データベースモデルエラー' });
    }
    
    // アグリゲーションパイプラインを構築
    const pipeline = [];
    
    // 除外IDがある場合、それらを除外
    if (excludeIdsArr.length > 0) {
      pipeline.push({
        $match: {
          fanzaId: { $nin: excludeIdsArr }
        }
      });
    }
    
    // カーソルベースページングの条件
    if (lastId && lastUpdatedAt) {
      pipeline.push({
        $match: {
          $or: [
            { updatedAt: { $lt: new Date(lastUpdatedAt) } },
            { updatedAt: new Date(lastUpdatedAt), _id: { $lt: new Types.ObjectId(String(lastId)) } }
          ]
        }
      });
    }
    
    // フィルタリング条件を追加
    const matchConditions = {};
    const matchFields = [];
    
    if (genreArr.length > 0) {
      matchFields.push({ genre: { $in: genreArr } });
    }
    
    if (tagsArr.length > 0) {
      matchFields.push({ tags: { $in: tagsArr } });
    }
    
    if (authorsArr.length > 0) {
      matchFields.push({ author: { $in: authorsArr } });
    }
    
    if (matchFields.length > 0) {
      pipeline.push({
        $match: {
          $or: matchFields
        }
      });
    }
    
    // レコメンドのスコア計算（関連度スコア）
    pipeline.push({
      $addFields: {
        relevanceScore: {
          $add: [
            // ジャンルが一致すると基本スコア5を追加
            { $cond: [
              { $in: ["$genre", genreArr] },
              5,
              0
            ]},
            // タグが一致するごとに2点追加
            { $multiply: [
              { $size: { $setIntersection: ["$tags", tagsArr] } },
              2
            ]},
            // 作者が一致すると3点追加
            { $cond: [
              { $in: ["$author", authorsArr] },
              3,
              0
            ]},
            // 評価（rating）があれば、その値に応じたスコア
            { $cond: [
              { $gt: ["$rating", 0] },
              { $multiply: ["$rating", 0.5] },
              0
            ]},
            // 人気度に基づくスコア
            { $cond: [
              { $gt: ["$popularity", 0] },
              { $multiply: ["$popularity", 0.3] },
              0
            ]}
          ]
        }
      }
    });
    
    // スコア順に並べ替え
    pipeline.push({
      $sort: {
        relevanceScore: -1,
        updatedAt: -1,
        _id: -1
      }
    });
    
    // 結果を制限
    pipeline.push({
      $limit: parseInt(limit)
    });
    
    console.log('レコメンデーションパイプライン:', JSON.stringify(pipeline));
    
    // アグリゲーションを実行
    const recommendations = await MangaModel.aggregate(pipeline);
    
    // 取得したデータをログに表示
    console.log('取得したレコメンデーションデータ:', recommendations);
    
    console.log(`レコメンデーション結果: ${recommendations.length}件`);
    
    if (recommendations.length === 0) {
      return res.status(200).json({
        data: [],
        hasMore: false
      });
    }
    
    // 次のページのカーソル情報
    const lastItem = recommendations[recommendations.length - 1];
    const nextCursor = {
      lastId: lastItem._id.toString(),
      lastUpdatedAt: lastItem.updatedAt.toISOString()
    };
    
    return res.status(200).json({
      data: recommendations,
      nextCursor: nextCursor,
      hasMore: recommendations.length === parseInt(limit)
    });
  } catch (error) {
    console.error('レコメンデーション取得エラー:', error);
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * ジャンルと対応する作品数を取得
 * 作品数が多い順に並べ替えて返す
 */
exports.getGenreCounts = async (req, res) => {
  console.log('[Controller] ジャンル作品数取得処理を開始');
  
  try {
    // MongoDB接続確認
    if (!mongoose.connection.readyState) {
      console.error('[Controller] MongoDB未接続');
      return res.status(500).json({ message: 'データベース接続エラー' });
    }
    
    // Mangaモデルが読み込まれていなければ読み込む
    const Manga = mongoose.connection.models.Manga || 
                 mongoose.model('Manga', MangaSchema);
    
    // タグごとの集計を行う
    const genres = await Manga.aggregate([
      // tagsフィールドを展開
      { $unwind: '$tags' },
      // タグごとにグループ化してカウント
      { 
        $group: { 
          _id: '$tags', 
          count: { $sum: 1 } 
        } 
      },
      // 作品数で降順ソート
      { $sort: { count: -1 } },
      // 結果をフォーマット
      { 
        $project: { 
          _id: 0, 
          genre: '$_id', 
          count: 1 
        } 
      }
    ]);
    
    console.log(`[Controller] ${genres.length}件のジャンルデータを取得`);
    
    // 結果を返す
    return res.status(200).json(genres);
  } catch (error) {
    console.error('[Controller] ジャンル集計エラー:', error);
    return res.status(500).json({ message: 'ジャンル集計中にエラーが発生しました' });
  }
};

// ジャンルによる検索
exports.searchByGenre = async (req, res) => {
  try {
    console.log('[Server] searchByGenreリクエスト:', {
      params: req.params,
      query: req.query,
      body: req.body
    });

    // 必須パラメータの確認
    const { genre } = req.query;
    if (!genre) {
      return res.status(400).json({ error: 'ジャンルの指定が必要です' });
    }
    
    // MangaModelが正しく読み込まれているか確認
    if (!MangaModel) {
      console.error('[Server] MangaModelが読み込まれていません');
      return res.status(500).json({ error: 'サーバー内部エラー：データモデルの読み込みに失敗しました' });
    }
    
    // MongoDB接続状態の確認
    if (mongoose.connection.readyState !== 1) {
      console.error('[Server] データベース接続エラー, 現在の状態:', mongoose.connection.readyState);
      return res.status(500).json({ error: 'データベース接続エラー' });
    }

    // ページネーションパラメータを取得（クエリパラメータから）
    const limit = parseInt(req.query.limit) || 20; // デフォルト20件
    
    // カーソル情報を取得
    const { lastId, lastUpdatedAt } = req.query;
    
    // 詳細なカーソル情報のログ出力
    if (lastId && lastUpdatedAt) {
      console.log('[Server] カーソル情報を受信:', {
        lastId,
        lastUpdatedAt,
        lastIdType: typeof lastId,
        lastUpdatedAtType: typeof lastUpdatedAt
      });
    }
    
    // ジャンル検索条件を構築
    const genres = genre.split(','); // カンマ区切りのジャンルを配列に変換
    console.log('[Server] 検索ジャンル:', genres);
    
    // クエリ構築
    let query = {};
    
    // 複数ジャンルの場合はOR条件で検索
    if (genres.length > 1) {
      // 複数ジャンルをOR条件で検索
      query = { tags: { $in: genres } };
    } else {
      // 単一ジャンルの場合
      query = { tags: genre };
    }
    
    // カーソル情報があれば追加
    if (lastId && lastUpdatedAt) {
      // updatedAt: -1, _id: -1 のソート順序と一致するカーソル条件
      // 降順ソートでは $lt を使用
      query.$or = [
        { updatedAt: { $lt: new Date(lastUpdatedAt) } },
        { 
          updatedAt: new Date(lastUpdatedAt), 
          _id: { $lt: lastId }
        }
      ];
    }
    
    console.log('[Server] 実行クエリ:', JSON.stringify(query, null, 2));

    // クエリ実行 - 更新日時が新しい順（降順）、同じ更新日時の場合はID降順
    const mangaList = await MangaModel.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1) // 次ページ判定用に1件多く取得
      .lean();

    console.log('[Server] ジャンル検索結果件数:', mangaList.length);
    
    // 取得データの最初と最後のIDをログ出力
    if (mangaList.length > 0) {
      console.log('[Server] 取得データの最初のID:', mangaList[0]._id.toString());
      console.log('[Server] 取得データの最初の更新日時:', mangaList[0].updatedAt);
      
      if (mangaList.length > 1) {
        const lastItem = mangaList[mangaList.length - 1];
        console.log('[Server] 取得データの最後のID:', lastItem._id.toString());
        console.log('[Server] 取得データの最後の更新日時:', lastItem.updatedAt);
      }
    }
    
    // 次ページがあるかをチェック（limit+1件取得したので、limit以上なら次ページあり）
    const hasMore = mangaList.length > limit;
    
    // レスポンス用のデータを準備（次ページ判定用の余分なデータは除外）
    const results = hasMore ? mangaList.slice(0, limit) : mangaList;
    
    // nextCursorを作成（次ページがある場合のみ）
    let nextCursor = null;
    if (hasMore && results.length > 0) {
      const lastItem = results[results.length - 1];
      nextCursor = {
        lastId: lastItem._id.toString(),
        lastUpdatedAt: lastItem.updatedAt.toISOString()
      };
      console.log('[Server] 次ページカーソル:', nextCursor);
    } else {
      console.log('[Server] 次ページなし');
    }
    
    // レスポンスを返す
    console.log('[Server] ジャンル検索レスポンス件数:', results.length, 'hasMore:', hasMore);
    return res.status(200).json({
      data: results,
      hasMore,
      nextCursor
    });
  } catch (error) {
    console.error('[Server] ジャンル検索エラー:', error);
    return res.status(500).json({ error: 'ジャンル検索中にエラーが発生しました' });
  }
};

// キーワードとジャンルの複合検索
exports.searchCombined = async (req, res) => {
  try {
    const query = req.query.query;
    const genreParam = req.query.genre;
    const limit = parseInt(req.query.limit, 10) || 20;
    const lastId = req.query.lastId;
    const lastUpdatedAt = req.query.lastUpdatedAt;
    
    console.log(`複合検索リクエスト: 検索語="${query}", ジャンル=${genreParam}, 取得上限=${limit}, 最終ID=${lastId}, 最終更新=${lastUpdatedAt}`);
    
    if (!query) {
      return res.status(400).json({ error: '検索語は必須です' });
    }
    
    // 検索キーワードを分割
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
    
    // ページング用のクエリを構築
    let mongoQuery = {
      $and: [
        // キーワード条件（タイトル、著者、タグに部分一致）
        {
          $or: [
            ...keywords.map(keyword => ({ title: { $regex: keyword, $options: 'i' } })),
            ...keywords.map(keyword => ({ author: { $regex: keyword, $options: 'i' } })),
            ...keywords.map(keyword => ({ tags: { $in: [new RegExp(keyword, 'i')] } }))
          ]
        }
      ]
    };
    
    // ジャンルが指定されている場合、条件を追加
    if (genreParam) {
      // カンマ区切りのジャンルを配列に分割
      const genres = genreParam.split(',').map(g => g.trim()).filter(g => g);
      console.log(`検索対象ジャンル (AND検索): ${genres.join(', ')}`);
      
      // AND検索に変更
      if (genres.length > 0) {
        mongoQuery.$and.push({ tags: { $all: genres } });
      }
    }
    
    // カーソル情報がある場合はページング条件を追加
    if (lastId && lastUpdatedAt) {
      mongoQuery.$and.push({
        $or: [
          { updatedAt: { $lt: new Date(lastUpdatedAt) } },
          {
            updatedAt: new Date(lastUpdatedAt),
            _id: { $lt: new Types.ObjectId(String(lastId)) }
          }
        ]
      });
    }
    
    console.log('MongoDB検索クエリ:', JSON.stringify(mongoQuery));

    // 漫画データを取得（最新順）
    const manga = await MangaModel.find(mongoQuery)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1);  // 次のページがあるかチェックするため1件多く取得
      
    console.log(`MongoDB検索結果: ${manga.length}件`);
    
    // 次のページ用のカーソル情報を計算
    const hasMore = manga.length > limit;
    const results = hasMore ? manga.slice(0, limit) : manga;
    
    // 次のカーソル情報を生成
    let nextCursor = null;
    if (hasMore && results.length > 0) {
      const lastItem = results[results.length - 1];
      nextCursor = {
        lastId: lastItem._id.toString(),
        lastUpdatedAt: lastItem.updatedAt.toISOString()
      };
    }
    
    return res.status(200).json({
      data: results,
      nextCursor,
      hasMore
    });
  } catch (error) {
    console.error('複合検索エラー:', error);
    return res.status(500).json({ error: error.message });
  }
}; 