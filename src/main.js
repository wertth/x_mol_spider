
import { DOUBLE_FIRST_CLASS_UNIVERSITY_LIST, SOURCE_URL, TEACHER_QUERY_SUFFIX_FILE_PATH, DEPARTMENT_FILE_PATH } from './constants.js';
import axios from 'axios'
import cheerio from 'cheerio'
import { AsyncPool } from './asyncPool.js';
import fs from "fs"
import readLine from "readline"


// return query suffix array of all school
const findSchools = async (homepageUrl) => {
    return await axios.get(homepageUrl)
        .then((res) => {
            // console.log(res.data);
            const html = res.data
            const root = cheerio.load(html)
            const schoolArray = []
            root('.first-detail-name > ul > li > a').each(
                (i, element) => {
                const schoolName = root(element).text().trim()
                if(DOUBLE_FIRST_CLASS_UNIVERSITY_LIST.includes(schoolName)) {
                    const schoolUrlSuffix = root(element).attr('href')
                    schoolArray.push({name:schoolName, suffix:schoolUrlSuffix})
                }
            }
            )
            // console.log(schoolArray.length)
            return schoolArray
        })
        .catch(err=> {
            console.log(err.response.data)
            throw new Error('cannot load url') 
        } )
}

const detailedSchoolUrl = (suffix) => { return `https://www.x-mol.com${suffix}` }
const parseDepartmentTaskArray = (schoolArray) => {
    const promiseArr = []
    for(const { name, suffix } of schoolArray) {
        let task = async () => {
            try {
                const res = await axios.get(detailedSchoolUrl(suffix))
                return parseDepartments(res.data)
            } catch(err) {
                console.log(err.response ? err.response.data : err.message);
                return err;
            }
        }
        promiseArr.push(task)
    }
    return promiseArr;
}
//找到某一个学校的所有学院
function parseDepartments(htmlData) {
    const $ = cheerio.load(htmlData);
    const departmentsArray = []
    $('.teacher-list-left > li').each(
        (i,element) => {
            let departmentName = element.attribs.title
            if(!departmentName) return
            const department = $(element)
            const href = department.find('a').attr('href');
            departmentsArray.push({
                name: departmentName,
                suffix: href
            })  
            
        }
    )

    return departmentsArray
}

const seizeAllDepartments = async () => {
    const schoolArray = await findSchools(SOURCE_URL)
    const promiseArr = parseDepartmentTaskArray(schoolArray);

    let pool = new AsyncPool(promiseArr,0.1)

    const departmentsInfoArr = await pool.run();
    // for(const departments of results) {
    //     departmentsInfoArr.push(...departments)
    // }
    
    const str = departmentsInfoArr
                .map((depart,index)=> `${index}: ${JSON.stringify(depart)}`)
                .join('\n')
    fs.writeFile(DEPARTMENT_FILE_PATH, str , 'utf-8', err => {
        if(err) console.log(err)
    })
}

const hasSeizedDepartment = () => {
    try {
        fs.accessSync(DEPARTMENT_FILE_PATH, fs.constants.F_OK)
        return true
    } catch (err) {
        console.log(err.message)
        return false
    }
}
// 组织请求学院首页列表
async function resolveTeacherInfoArr() {
    return new Promise((resolve, reject) => {
        try {
            const readStream = fs.createReadStream(DEPARTMENT_FILE_PATH)

            const writeStream = fs.createWriteStream(TEACHER_QUERY_SUFFIX_FILE_PATH)
            const writeStream2 = fs.createWriteStream(TEACHER_QUERY_SUFFIX_FILE_PATH + 'info')
            const rl = readLine.createInterface({
                input: readStream,
                crlfDelay: Infinity
            })


            const pool  = new AsyncPool([], 0.1)
            const tasks = []

            rl.on('line', async (line) => {
                const department = JSON.parse(line.replace(/\d+:\s*/, ''))
                const key = department.suffix
                let task = async () => {
                    try {
                      const teacherSuffixArr = await getTeachers(department.suffix);
                      console.log('拉取学院老师共', teacherSuffixArr.length, '名')
                      
                      if (teacherSuffixArr.length > 0) {
                        let str = teacherSuffixArr.map(item => JSON.stringify(item)).join('\n') + '\n';
                        writeStream.write(str);
                      }
          
                      // 进一步处理教师信息，可以取消注释以下代码
                        const subTasks = []
                        teacherSuffixArr.forEach(item => {
                            let task2 = async () => {
                                try {
                                    const teacherInfo = await resolveTeacherInfo(item);
                                    const str = JSON.stringify(teacherInfo) + '\n'
                                    writeStream2.write(str);
                                    return str
                                } catch(err) {
                                    console.error(err)
                                }
                                
                            }
                            subTasks.push(task2)
                        });
                        pool.push_front(...subTasks)
                      
                        return 'ok'
                    } catch (error) {
                        return 'err'
                    }
                  };
                
                tasks.push(task)

            })


            rl.on('close', async () => {
                pool.push(...tasks);
                // (await pool.getResults()).flat()
            })

        } catch(err) {
            console.log(err.message)

            reject(err.message)
        }
    })
}

async function getTeachers(departmentSuffix) {
    try {
        const prefix = 'https://www.x-mol.com'

        let url = prefix + departmentSuffix
    
        const htmlData = await axios.get(url)
                                    .then(res=> res.data)
    
        const $ = cheerio.load(htmlData);
        const teacherArray = []
        $('.first-detail-name > ul > li > a').each(
            (i,element) => {
                teacherArray.push(element.attribs.href)
            }
        )
        return teacherArray
    } catch ( err) {
        console.error(err.message)
        return []
    }
}


async function main() {
    
    // await seizeAllDepartments()
    const flag = hasSeizedDepartment();

    if(!flag) {
        await seizeAllDepartments();
    }

    // departments => teachers
    const teacherQuerySuffixArr =  await resolveTeacherInfoArr();





}


function formatArticles(articlesText) {
    // 使用正则表达式匹配所有的文章条目
    const articleEntries = articlesText.split('\n').filter(line => line.trim() !== '');
    
    // 处理每个匹配的文章
    return articleEntries.map((entry, index) => {
        // 去除多余的空格和合并信息
        const cleanEntry = entry.trim().replace(/\s+/g, ' ');
        
        // 添加编号
        return `${cleanEntry}`;
    }); // 每个条目换行显示
}



async function resolveTeacherInfo(suffix) {
    const prefix = 'https://www.x-mol.com'

    let url = prefix + suffix
    const htmlData = await axios.get(url)
                                .then(res => res.data)
    const $ = cheerio.load(htmlData)
    const teacherInfo = {}

    const name = $('.teacher-name-text').text().trim();
    let researchField = ""
    let articles = []
    $('.teacher-list-detail-article').each(
        (i, element) => {
            //研究领域
            if(i === 1) {
                researchField = $(element).find('p').eq(1).text()
            }
            //近期文章
            if(i === 2){
                let rawArticles = $(element).find('p').text()
                articles = formatArticles(rawArticles)
            }

        }
    )

    Object.assign(teacherInfo,{
        name,
        researchField,
        articles
    })
    return teacherInfo
}







main().then()


