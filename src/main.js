
import { DOUBLE_FIRST_CLASS_UNIVERSITY_LIST, SOURCE_URL, TEACHER_QUERY_SUFFIX_FILE_PATH, DEPARTMENT_FILE_PATH, SAVE_CONDITION_FILE_PATH } from './constants.js';
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
// 从学院 查询 学院老师并保存
async function resolveTeacherInfoArr(start) {

    return new Promise((resolve, reject) => {
        try {
            const readStream = fs.createReadStream(DEPARTMENT_FILE_PATH)

            const writeStream = fs.createWriteStream(TEACHER_QUERY_SUFFIX_FILE_PATH, {flags:'a'})
            const writeStream2 = fs.createWriteStream(TEACHER_QUERY_SUFFIX_FILE_PATH + 'info', {flags:'a'})
            const rl = readLine.createInterface({
                input: readStream,
                crlfDelay: Infinity
            })


            const pool  = new AsyncPool([], 0.1)
            const tasks = []

            rl.on('line', async (line) => {
                const pattern = /\d+:\s*/
                const matches = pattern.exec(line)
                const curLine = parseInt(matches[0].slice(0, matches[0].length - 2, 1))
                if(curLine < start) return;

                const department = JSON.parse(line.replace(pattern, ''))
                const key = department.suffix
                let task = async () => {
                    try {
                      const teacherSuffixArr = await getTeachers(department.suffix);
                      //  /university/detail/903/department/3422
                      const universityId = department.suffix.split('/')[3]
                      const departmentId = department.suffix.split('/')[5]
                      console.log('拉取学院老师共', teacherSuffixArr.length, '名')
                      
                      if (teacherSuffixArr.length > 0) {
                        let str = teacherSuffixArr.map(item => JSON.stringify(item)).join('\n') + '\n';
                        writeStream.write(str);
                      }
          
                      // 进一步处理教师信息，可以取消注释以下代码
                      const subTasks = []
                      teacherSuffixArr.forEach((item,index) => {
                          let task2 = async () => {
                              try {
                                  const teacherInfo = await resolveTeacherInfo(item, universityId);
                                  const str = JSON.stringify(teacherInfo) + '\n'
                                  writeStream2.write(str);
                                
                                  if(index === teacherSuffixArr.length - 1) {
                                    console.log('执行保存进度')
                                    const saveCondition = {
                                        universityId,
                                        departmentId
                                    }
                                    fs.writeFileSync(SAVE_CONDITION_FILE_PATH, JSON.stringify(saveCondition), err=>err)
                                  }
                                  

                                  return teacherInfo.name
                              } catch(err) {
                                  console.error(err)
                                  return err.message
                              }
                              
                          }
                          subTasks.push(task2)
                      });
                      pool.push_front(...subTasks)
                    
                      return universityId    
                    } catch (error) {
                        return error.message
                    }
                };
                
                tasks.push(task)

            })


            rl.on('close', async () => {
                pool.push(...tasks);
                await pool.run()
                resolve('resolve finished')
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


// 组装存储老师条目
async function resolveTeacherInfo(suffix,universityId) {
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
            const title =  $(element).find('h3').text()
            switch (title) {
                case '个人简介': break;
                case '研究领域': {
                    $(element).find('p').each((_,elem) => {
                        researchField += $(elem)
                                        .text()
                                        .trim()
                                        .replace(/\n/g, ',')
                    })
                    break;
                }
                case '近期论文': {
                    let rawArticles = $(element).find('p').text()
                    articles = formatArticles(rawArticles)
                    break;
                }
            }

        }
    )

    Object.assign(teacherInfo,{
        name,
        facultyId: suffix.split('/').reverse()[0],
        universityId,
        researchField,
        articles
    })
    return teacherInfo
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


function lastSavedUniversityId() {
    const data = fs.readFileSync(SAVE_CONDITION_FILE_PATH, 'utf-8', err=> {
        if(err) throw new Error('no saved process');
    })
    return JSON.parse(data)
}

async function searchbreakPointLine({universityId,  departmentId}) {
    return new Promise((resolve, reject) => {
        const rl = readLine.createInterface({
            input: fs.createReadStream(DEPARTMENT_FILE_PATH),
            output: process.stdout,
            terminal: false
        });
        // university/detail/441/department/6355
        const pattern = new RegExp(`${universityId}/department/${departmentId}`)
        rl.on("line", async stream => {
            if(pattern.test(stream)) {
                resolve(stream)
            }
        })
        rl.on('close', _ => {
            reject('no match line')
        })
    })
}

function main() {
    
    // await seizeAllDepartments()
    // const flag = hasSeizedDepartment();

    // if(!flag) {
    //     seizeAllDepartments().then(res=>console.log(res));
    // }


    //查询目前已抓取末尾departmentId
    // const savedCondition = lastSavedUniversityId()
    // searchbreakPointLine(savedCondition)
    //     .then(line=>{
    //         const pattern = /\d+:\s*/
    //         const matches = pattern.exec(line)
    //         const lineNum = matches[0].slice(0, matches[0].length - 2, 1)
    //         return parseInt(lineNum)
    //     })
    //     .catch(err=>console.error(err.message))
    //     .then(lineNum => {
    //         resolveTeacherInfoArr(lineNum).then()
    //     })


}

main()

