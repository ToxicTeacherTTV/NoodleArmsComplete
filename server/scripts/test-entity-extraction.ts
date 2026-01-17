/**
 * Test entity extraction on a specific piece of text
 * Run with: npx tsx server/scripts/test-entity-extraction.ts
 */

import { entityExtraction } from "../services/entityExtraction.js";
import dotenv from 'dotenv';

dotenv.config();

const testText = `
Nicky A.I. Dente
My father. Oh no, oh no. This is the ugly one. Yeah, your father is the ugly one? His name was Salvatore Dente. Ooh. Yeah, real subtle. Yeah. Guy smelled like cigarettes in disappointment. He sounded. He never yelled, which was worse. Oh wow. When he was mad, he got quiet. Like the room owed him money. Oh. His relationship with my mother was a fucking war. Wow. Screaming matches about money, pride, respect. This, wow. Two people who loved each other just enough to ruin each other's lives.
`;

async function main() {
  console.log('🧪 ENTITY EXTRACTION TEST\n');
  console.log('=' .repeat(60));
  console.log('Testing with Salvatore Dente text:\n');
  console.log(testText);
  console.log('=' .repeat(60));

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  try {
    // Mock existing entities (empty)
    const mockExisting = {
      people: [],
      places: [],
      events: [],
      concepts: [],
      items: [],
      misc: []
    };

    console.log('\n🤖 Calling extractEntitiesFromMemory...\n');

    const result = await (entityExtraction as any).extractEntitiesFromMemory(testText, mockExisting);

    console.log('✅ EXTRACTION RESULT:\n');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n' + '=' .repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`Total entities found: ${result.entities?.length || 0}`);

    if (result.entities) {
      const people = result.entities.filter((e: any) => e.type === 'PERSON');
      console.log(`\n👥 PEOPLE (${people.length}):`);
      people.forEach((p: any) => {
        console.log(`  - ${p.name} (${p.disambiguation || 'no disambiguation'})`);
        if (p.relationship) console.log(`    Relationship: ${p.relationship}`);
      });

      // Check specifically for Salvatore
      const salvatore = people.find((p: any) =>
        p.name.toLowerCase().includes('salvatore') ||
        p.name.toLowerCase().includes('father')
      );

      if (salvatore) {
        console.log('\n✅ SUCCESS: Found Salvatore Dente / Father entity!');
      } else {
        console.log('\n❌ FAILED: Did NOT find Salvatore Dente / Father entity');
        console.log('   The prompt may need further adjustment');
      }

      // Check for mother
      const mother = people.find((p: any) =>
        p.name.toLowerCase().includes('mother')
      );

      if (mother) {
        console.log('✅ SUCCESS: Found Mother entity!');
      } else {
        console.log('❌ FAILED: Did NOT find Mother entity');
      }
    }

  } catch (error) {
    console.error('❌ Extraction failed:', error);
  }
}

main();
