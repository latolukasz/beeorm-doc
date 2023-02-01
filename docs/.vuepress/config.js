import { defineUserConfig } from 'vuepress'
import { defaultTheme } from 'vuepress'
import { googleAnalyticsPlugin } from '@vuepress/plugin-google-analytics'
import { searchPlugin } from '@vuepress/plugin-search'

export default defineUserConfig({
  lang: 'en-US',
  title: 'BeeORM: A Golang ORM for MySQL and Redis',
  description: 'BeeORM is a Golang ORM designed for high-traffic applications that require optimal performance and scalability. Our ORM allows developers to easily build and maintain applications that can handle large amounts of data and traffic, using the power and simplicity of Golang, along with the reliability and speed of MySQL and Redis',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],
  plugins: [
    googleAnalyticsPlugin({
      id: 'UA-195751907-1',
    }),
    searchPlugin({})
  ],
  theme: defaultTheme({
    logo: '/logo-small.svg',
    logoDark: '/logo-small-dark.svg',
    repo: 'https://github.com/latolukasz/beeorm',
    docsRepo: 'https://github.com/latolukasz/beeorm-doc',
    docsBranch: 'v2',
    docsDir: 'docs',
    navbar: [
      {
        text: 'Guide',
        link: '/guide/',
      },
      {
        text: 'V2',
        children: [
          {
            text: 'V1',
            link: 'https://v1.beeorm.io/',
          },
        ],
      },
    ],
    sidebar: {
      '/guide/': [
        {
          title: 'Guide',
          children: [
            'registry',
            'data_pools',
            'entities',
            'entity_fields',
            'mysql_indexes',
            'validated_registry',
            'engine',
            'schema_update',
            'crud',
            'search',
            'background_consumer',
            'lazy_crud',
            'uuid',
            'cached_queries',
            'mysql_queries',
            'local_cache',
            'redis_operations',
            'distributed_lock',
            'event_broker',
            'log_tables',
            'queries_log',
          ]
        }]
    }
  })
})