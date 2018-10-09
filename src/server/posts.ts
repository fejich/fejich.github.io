import * as fs from 'fs'
import Model from './model'
import * as fse from 'fs-extra'
import * as path from 'path'
const junk = require('junk')
import { IPost } from './interfaces/post'
import ContentHelper from './helpers/content-helper'
import * as matter from 'gray-matter'
import * as Bluebird from 'bluebird'
Bluebird.promisifyAll(fs)

export default class Posts extends Model {
  postDir: string

  constructor(appInstance: any) {
    super(appInstance)
    this.postDir = path.join(this.appDir, 'posts')
    this.savePosts()
  }

  public async savePosts() {
    const resultList: any = []
    const requestList: any = []
    let files = await fse.readdir(this.postDir)

    files = files.filter(junk.not)
    files.forEach((item) => {
      requestList.push(fs.readFileSync(path.join(this.postDir, item), 'utf8'))
    })
    const results = await Bluebird.all(requestList)
    results.forEach((result: any, index: any) => {
      const postMatter = matter(result)
      delete postMatter.orig // Remove orig <Buffer>
      const post = {
        ...postMatter,
        abstract: '',
        fileName: '',
      }
      
      post.abstract = (post.content).substring(0, post.content.indexOf('<!-- more -->')) // 摘要
      post.fileName = files[index].substring(0, files[index].length - 3) // 有待优化!
      resultList.push(post)
    })
    
    const list : any = []
    resultList.forEach((item: any) => {
      // 从 hexo 或其他平台迁移过来的文章不带有 published 字段
      if (item.data.published === undefined) {
        item.data.published = false
        list.push(item)
      } else {
        list.push(item)
      }
    })
    this.$posts.set('posts', list).write()
    return true
  }

  async list() {
    console.log('执行了')
    await this.savePosts()
    // await this.$posts.defaults({ posts: [] }).write()
    const posts = await this.$posts.get('posts').value()
    console.log('查询结果:::', posts)
    return posts
  }

  async savePostToFile(post: IPost): Promise<IPost | null> {
    console.log(post)
    const helper = new ContentHelper()
    const content = helper.changeImageUrlLocalToDomain(post.content, '')
    const mdStr = `---
title: ${post.title}
date: ${post.date}
tags: ${post.tags.join(' ')}
published: ${post.published}
---
${content}
`
    try {
      // write file must use fse, beause fs.writeFile need callback
      await fse.writeFile(`${this.postDir}/${post.fileName}.md`, mdStr)
    } catch (e) {
      console.error('ERROR: ', e)
    }
    return post
  }
}