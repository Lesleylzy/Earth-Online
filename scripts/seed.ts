import { createClient } from '@supabase/supabase-js'
import { seedTasks } from '../src/lib/seed-tasks'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment')
  console.error('Make sure .env.local is configured properly')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log('Checking existing tasks...')
  const { count } = await supabase.from('public_tasks').select('*', { count: 'exact', head: true })

  if (count && count > 0) {
    console.log(`Database already has ${count} tasks. Skipping seed.`)
    console.log('If you want to re-seed, delete existing tasks first.')
    return
  }

  console.log(`Inserting ${seedTasks.length} tasks...`)
  const { error } = await supabase.from('public_tasks').insert(seedTasks)

  if (error) {
    console.error('Seed failed:', error.message)
    console.error('Make sure you are signed in as admin and RLS policies are set up.')
    process.exit(1)
  }

  console.log(`Successfully seeded ${seedTasks.length} tasks!`)
}

seed()
