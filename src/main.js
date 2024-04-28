
import { DOUBLE_FIRST_CLASS_UNIVERSITY_LIST, SOURCE_URL } from './constants.js';
import axios from 'axios'
import cheerio from 'cheerio'

const url= SOURCE_URL
// [{name, id}]
axios.get(url)
    .then((res) => {
        // console.log(res.data);
        const html = res.data
        const root = cheerio.load(html)
        const schoolArray = []
        root('.first-detail-name > ul > li > a').each(
            (i, element) => {
            const schoolName = root(element).text().trim()
            if(DOUBLE_FIRST_CLASS_UNIVERSITY_LIST.includes(schoolName)) {
                const schoolId = root(element).attr('href')
                schoolArray.push({name:schoolName, id:schoolId})
            }
        }
        )
        console.log(schoolArray.length)
        

    })

