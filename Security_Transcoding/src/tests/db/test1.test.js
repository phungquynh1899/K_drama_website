describe('each test should show console.log', ()=>{
    beforeEach(()=>{
        console.log('beforeEach')
    })
    afterEach(()=>{
        console.log('afterEach')
    })

    afterAll(()=>{
        console.log('afterAll')
    })

    test('test1',()=>{
        console.log('im test 1')
        expect(1).toBe(1)
    })

    test('test1',()=>{
        console.log('im test 2')
        expect(1).toBe(1)
    })
    
})