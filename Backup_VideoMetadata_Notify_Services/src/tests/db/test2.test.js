const BetterSqliteDatabase = require('../../db/BetterSqliteDatabase.js');

describe('each test should show console.log', ()=>{
    let db1;
    let db2;
    let db;

  beforeEach(() => {
    db = BetterSqliteDatabase.getInstance(':memory:');
  });

  afterEach(() => {
    db.db.close();
     //forcing _instance=null 
     BetterSqliteDatabase._instance = null
  });

    test('test1',()=>{
        console.log('im test 1')
        db1 = db;
        expect(1).toBe(1)
    })

    test('test1',()=>{
        console.log('im test 2')
        db2 = db;
        console.log("is db1 the same db2", db1 === db2)
        console.log("is databse that db1 points to the same as databse that db2 points to: ", db1.db === db2.db)
        //đúng như dự đoán db1 khác db2 
        //tức là mỗi test đều tạo 1 db khác nhau 
        expect(1).toBe(1)
    })
    
})