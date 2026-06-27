import os
import sys
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from collections import Counter

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, SessionLocal
from app import models

# ============================================================
# FRY SIGHT WORDS - CLEANED (NO DUPLICATES)
# ============================================================

fry_words = [
    # ===== LEVEL 1 (Fry's 1st 100) - Pre-Primer =====
    ("the", "Pre-Primer"), ("of", "Pre-Primer"), ("and", "Pre-Primer"), ("a", "Pre-Primer"),
    ("to", "Pre-Primer"), ("in", "Pre-Primer"), ("is", "Pre-Primer"), ("you", "Pre-Primer"),
    ("that", "Pre-Primer"), ("it", "Pre-Primer"), ("he", "Pre-Primer"), ("was", "Pre-Primer"),
    ("for", "Pre-Primer"), ("on", "Pre-Primer"), ("are", "Pre-Primer"), ("as", "Pre-Primer"),
    ("with", "Pre-Primer"), ("his", "Pre-Primer"), ("they", "Pre-Primer"), ("I", "Pre-Primer"),
    ("at", "Pre-Primer"), ("be", "Pre-Primer"), ("this", "Pre-Primer"), ("have", "Pre-Primer"),
    ("from", "Pre-Primer"), ("or", "Pre-Primer"), ("one", "Pre-Primer"), ("had", "Pre-Primer"),
    ("by", "Pre-Primer"), ("word", "Pre-Primer"), ("but", "Pre-Primer"), ("not", "Pre-Primer"),
    ("what", "Pre-Primer"), ("all", "Pre-Primer"), ("were", "Pre-Primer"), ("we", "Pre-Primer"),
    ("when", "Pre-Primer"), ("your", "Pre-Primer"), ("can", "Pre-Primer"), ("said", "Pre-Primer"),
    ("there", "Pre-Primer"), ("use", "Pre-Primer"), ("an", "Pre-Primer"), ("each", "Pre-Primer"),
    ("which", "Pre-Primer"), ("she", "Pre-Primer"), ("do", "Pre-Primer"), ("how", "Pre-Primer"),
    ("their", "Pre-Primer"), ("if", "Pre-Primer"), ("will", "Pre-Primer"), ("up", "Pre-Primer"),
    ("other", "Pre-Primer"), ("about", "Pre-Primer"), ("out", "Pre-Primer"), ("many", "Pre-Primer"),
    ("then", "Pre-Primer"), ("them", "Pre-Primer"), ("these", "Pre-Primer"), ("so", "Pre-Primer"),
    ("some", "Pre-Primer"), ("her", "Pre-Primer"), ("would", "Pre-Primer"), ("make", "Pre-Primer"),
    ("like", "Pre-Primer"), ("him", "Pre-Primer"), ("into", "Pre-Primer"), ("time", "Pre-Primer"),
    ("has", "Pre-Primer"), ("look", "Pre-Primer"), ("two", "Pre-Primer"), ("more", "Pre-Primer"),
    ("write", "Pre-Primer"), ("go", "Pre-Primer"), ("see", "Pre-Primer"), ("number", "Pre-Primer"),
    ("no", "Pre-Primer"), ("way", "Pre-Primer"), ("could", "Pre-Primer"), ("people", "Pre-Primer"),
    ("my", "Pre-Primer"), ("than", "Pre-Primer"), ("first", "Pre-Primer"), ("water", "Pre-Primer"),
    ("been", "Pre-Primer"), ("call", "Pre-Primer"), ("who", "Pre-Primer"), ("oil", "Pre-Primer"),
    ("its", "Pre-Primer"), ("now", "Pre-Primer"), ("find", "Pre-Primer"), ("long", "Pre-Primer"),
    ("down", "Pre-Primer"), ("day", "Pre-Primer"), ("did", "Pre-Primer"), ("get", "Pre-Primer"),
    ("come", "Pre-Primer"), ("made", "Pre-Primer"), ("may", "Pre-Primer"), ("part", "Pre-Primer"),

    # ===== LEVEL 2 (Fry's 2nd 100) - Primer =====
    ("over", "Primer"), ("new", "Primer"), ("sound", "Primer"), ("take", "Primer"),
    ("only", "Primer"), ("little", "Primer"), ("work", "Primer"), ("know", "Primer"),
    ("place", "Primer"), ("years", "Primer"), ("live", "Primer"), ("me", "Primer"),
    ("back", "Primer"), ("give", "Primer"), ("most", "Primer"), ("very", "Primer"),
    ("after", "Primer"), ("things", "Primer"), ("our", "Primer"), ("just", "Primer"),
    ("name", "Primer"), ("good", "Primer"), ("sentence", "Primer"), ("man", "Primer"),
    ("think", "Primer"), ("say", "Primer"), ("great", "Primer"), ("where", "Primer"),
    ("help", "Primer"), ("through", "Primer"), ("much", "Primer"), ("before", "Primer"),
    ("line", "Primer"), ("right", "Primer"), ("too", "Primer"), ("means", "Primer"),
    ("old", "Primer"), ("any", "Primer"), ("same", "Primer"), ("tell", "Primer"),
    ("boy", "Primer"), ("follow", "Primer"), ("came", "Primer"), ("want", "Primer"),
    ("show", "Primer"), ("also", "Primer"), ("around", "Primer"), ("form", "Primer"),
    ("three", "Primer"), ("small", "Primer"), ("set", "Primer"), ("put", "Primer"),
    ("end", "Primer"), ("does", "Primer"), ("another", "Primer"), ("well", "Primer"),
    ("large", "Primer"), ("must", "Primer"), ("big", "Primer"), ("even", "Primer"),
    ("such", "Primer"), ("because", "Primer"), ("turn", "Primer"), ("here", "Primer"),
    ("why", "Primer"), ("ask", "Primer"), ("went", "Primer"), ("men", "Primer"),
    ("read", "Primer"), ("need", "Primer"), ("land", "Primer"), ("different", "Primer"),
    ("home", "Primer"), ("us", "Primer"), ("move", "Primer"), ("try", "Primer"),
    ("kind", "Primer"), ("hand", "Primer"), ("picture", "Primer"), ("again", "Primer"),
    ("change", "Primer"), ("off", "Primer"), ("play", "Primer"), ("spell", "Primer"),
    ("air", "Primer"), ("away", "Primer"), ("animal", "Primer"), ("house", "Primer"),
    ("point", "Primer"), ("page", "Primer"), ("letter", "Primer"), ("mother", "Primer"),
    ("answer", "Primer"), ("found", "Primer"), ("study", "Primer"), ("still", "Primer"),
    ("learn", "Primer"), ("should", "Primer"), ("America", "Primer"), ("world", "Primer"),

    # ===== LEVEL 3 (Fry's 3rd 100) - Grade 1 =====
    ("high", "Grade 1"), ("every", "Grade 1"), ("near", "Grade 1"), ("add", "Grade 1"),
    ("food", "Grade 1"), ("between", "Grade 1"), ("own", "Grade 1"), ("below", "Grade 1"),
    ("country", "Grade 1"), ("plant", "Grade 1"), ("last", "Grade 1"), ("school", "Grade 1"),
    ("father", "Grade 1"), ("keep", "Grade 1"), ("tree", "Grade 1"), ("never", "Grade 1"),
    ("start", "Grade 1"), ("city", "Grade 1"), ("earth", "Grade 1"), ("eyes", "Grade 1"),
    ("light", "Grade 1"), ("thought", "Grade 1"), ("head", "Grade 1"), ("under", "Grade 1"),
    ("story", "Grade 1"), ("saw", "Grade 1"), ("left", "Grade 1"), ("don't", "Grade 1"),
    ("few", "Grade 1"), ("while", "Grade 1"), ("along", "Grade 1"), ("might", "Grade 1"),
    ("close", "Grade 1"), ("something", "Grade 1"), ("seem", "Grade 1"), ("next", "Grade 1"),
    ("hard", "Grade 1"), ("open", "Grade 1"), ("example", "Grade 1"), ("begin", "Grade 1"),
    ("life", "Grade 1"), ("always", "Grade 1"), ("those", "Grade 1"), ("both", "Grade 1"),
    ("paper", "Grade 1"), ("together", "Grade 1"), ("got", "Grade 1"), ("group", "Grade 1"),
    ("often", "Grade 1"), ("run", "Grade 1"), ("important", "Grade 1"), ("until", "Grade 1"),
    ("children", "Grade 1"), ("side", "Grade 1"), ("feet", "Grade 1"), ("car", "Grade 1"),
    ("mile", "Grade 1"), ("night", "Grade 1"), ("walk", "Grade 1"), ("white", "Grade 1"),
    ("sea", "Grade 1"), ("began", "Grade 1"), ("grow", "Grade 1"), ("took", "Grade 1"),
    ("river", "Grade 1"), ("four", "Grade 1"), ("carry", "Grade 1"), ("state", "Grade 1"),
    ("once", "Grade 1"), ("book", "Grade 1"), ("hear", "Grade 1"), ("stop", "Grade 1"),
    ("without", "Grade 1"), ("second", "Grade 1"), ("late", "Grade 1"), ("miss", "Grade 1"),
    ("idea", "Grade 1"), ("enough", "Grade 1"), ("eat", "Grade 1"), ("face", "Grade 1"),
    ("watch", "Grade 1"), ("far", "Grade 1"), ("Indian", "Grade 1"), ("real", "Grade 1"),
    ("almost", "Grade 1"), ("let", "Grade 1"), ("above", "Grade 1"), ("girl", "Grade 1"),
    ("sometimes", "Grade 1"), ("mountain", "Grade 1"), ("cut", "Grade 1"), ("young", "Grade 1"),
    ("talk", "Grade 1"), ("soon", "Grade 1"), ("list", "Grade 1"), ("song", "Grade 1"),
    ("being", "Grade 1"), ("leave", "Grade 1"), ("family", "Grade 1"), ("it's", "Grade 1"),

    # ===== LEVEL 4 (Fry's 4th 100) - Grade 2 =====
    ("body", "Grade 2"), ("music", "Grade 2"), ("color", "Grade 2"), ("stand", "Grade 2"),
    ("sun", "Grade 2"), ("questions", "Grade 2"), ("fish", "Grade 2"), ("area", "Grade 2"),
    ("mark", "Grade 2"), ("dog", "Grade 2"), ("horse", "Grade 2"), ("birds", "Grade 2"),
    ("problem", "Grade 2"), ("complete", "Grade 2"), ("room", "Grade 2"), ("knew", "Grade 2"),
    ("since", "Grade 2"), ("ever", "Grade 2"), ("piece", "Grade 2"), ("told", "Grade 2"),
    ("usually", "Grade 2"), ("didn't", "Grade 2"), ("friends", "Grade 2"), ("easy", "Grade 2"),
    ("heard", "Grade 2"), ("order", "Grade 2"), ("red", "Grade 2"), ("door", "Grade 2"),
    ("sure", "Grade 2"), ("become", "Grade 2"), ("top", "Grade 2"), ("ship", "Grade 2"),
    ("across", "Grade 2"), ("today", "Grade 2"), ("during", "Grade 2"), ("short", "Grade 2"),
    ("better", "Grade 2"), ("best", "Grade 2"), ("however", "Grade 2"), ("low", "Grade 2"),
    ("hours", "Grade 2"), ("black", "Grade 2"), ("products", "Grade 2"), ("happened", "Grade 2"),
    ("whole", "Grade 2"), ("measure", "Grade 2"), ("remember", "Grade 2"), ("early", "Grade 2"),
    ("waves", "Grade 2"), ("reached", "Grade 2"), ("listen", "Grade 2"), ("wind", "Grade 2"),
    ("rock", "Grade 2"), ("space", "Grade 2"), ("covered", "Grade 2"), ("fast", "Grade 2"),
    ("several", "Grade 2"), ("hold", "Grade 2"), ("himself", "Grade 2"), ("toward", "Grade 2"),
    ("five", "Grade 2"), ("step", "Grade 2"), ("morning", "Grade 2"), ("passed", "Grade 2"),
    ("vowel", "Grade 2"), ("true", "Grade 2"), ("hundred", "Grade 2"), ("against", "Grade 2"),
    ("pattern", "Grade 2"), ("numeral", "Grade 2"), ("table", "Grade 2"), ("north", "Grade 2"),
    ("slowly", "Grade 2"), ("money", "Grade 2"), ("map", "Grade 2"), ("farm", "Grade 2"),
    ("pulled", "Grade 2"), ("draw", "Grade 2"), ("voice", "Grade 2"), ("seen", "Grade 2"),
    ("cold", "Grade 2"), ("cried", "Grade 2"), ("plan", "Grade 2"), ("notice", "Grade 2"),
    ("south", "Grade 2"), ("sing", "Grade 2"), ("war", "Grade 2"), ("ground", "Grade 2"),
    ("fall", "Grade 2"), ("king", "Grade 2"), ("town", "Grade 2"), ("I'll", "Grade 2"),
    ("unit", "Grade 2"), ("figure", "Grade 2"), ("certain", "Grade 2"), ("field", "Grade 2"),
    ("travel", "Grade 2"), ("wood", "Grade 2"), ("fire", "Grade 2"), ("upon", "Grade 2"),

    # ===== LEVEL 5 (Fry's 5th 100) - Grade 3 =====
    ("done", "Grade 3"), ("English", "Grade 3"), ("road", "Grade 3"), ("halt", "Grade 3"),
    ("fly", "Grade 3"), ("gave", "Grade 3"), ("box", "Grade 3"), ("finally", "Grade 3"),
    ("wait", "Grade 3"), ("correct", "Grade 3"), ("oh", "Grade 3"), ("quickly", "Grade 3"),
    ("person", "Grade 3"), ("became", "Grade 3"), ("shown", "Grade 3"), ("minutes", "Grade 3"),
    ("strong", "Grade 3"), ("verb", "Grade 3"), ("stars", "Grade 3"), ("front", "Grade 3"),
    ("feel", "Grade 3"), ("fact", "Grade 3"), ("inches", "Grade 3"), ("street", "Grade 3"),
    ("decided", "Grade 3"), ("contain", "Grade 3"), ("course", "Grade 3"), ("surface", "Grade 3"),
    ("produce", "Grade 3"), ("building", "Grade 3"), ("ocean", "Grade 3"), ("class", "Grade 3"),
    ("note", "Grade 3"), ("nothing", "Grade 3"), ("rest", "Grade 3"), ("carefully", "Grade 3"),
    ("scientists", "Grade 3"), ("inside", "Grade 3"), ("wheels", "Grade 3"), ("stay", "Grade 3"),
    ("green", "Grade 3"), ("known", "Grade 3"), ("island", "Grade 3"), ("week", "Grade 3"),
    ("less", "Grade 3"), ("machine", "Grade 3"), ("base", "Grade 3"), ("ago", "Grade 3"),
    ("stood", "Grade 3"), ("plane", "Grade 3"), ("system", "Grade 3"), ("behind", "Grade 3"),
    ("ran", "Grade 3"), ("round", "Grade 3"), ("boat", "Grade 3"), ("game", "Grade 3"),
    ("force", "Grade 3"), ("brought", "Grade 3"), ("understand", "Grade 3"), ("warm", "Grade 3"),
    ("common", "Grade 3"), ("bring", "Grade 3"), ("explain", "Grade 3"), ("dry", "Grade 3"),
    ("though", "Grade 3"), ("language", "Grade 3"), ("shape", "Grade 3"), ("deep", "Grade 3"),
    ("thousands", "Grade 3"), ("yes", "Grade 3"), ("clear", "Grade 3"), ("equation", "Grade 3"),
    ("yet", "Grade 3"), ("government", "Grade 3"), ("filled", "Grade 3"), ("heat", "Grade 3"),
    ("full", "Grade 3"), ("hot", "Grade 3"), ("check", "Grade 3"), ("object", "Grade 3"),
    ("am", "Grade 3"), ("rule", "Grade 3"), ("among", "Grade 3"), ("noun", "Grade 3"),
    ("power", "Grade 3"), ("cannot", "Grade 3"), ("able", "Grade 3"), ("six", "Grade 3"),
    ("size", "Grade 3"), ("dark", "Grade 3"), ("ball", "Grade 3"), ("material", "Grade 3"),
    ("special", "Grade 3"), ("heavy", "Grade 3"), ("fine", "Grade 3"), ("pair", "Grade 3"),
    ("circle", "Grade 3"), ("include", "Grade 3"), ("built", "Grade 3"),

    # ===== LEVEL 6 (Fry's 6th 100) - Grade 4 =====
    ("can't", "Grade 4"), ("matter", "Grade 4"), ("square", "Grade 4"), ("syllables", "Grade 4"),
    ("perhaps", "Grade 4"), ("bill", "Grade 4"), ("felt", "Grade 4"), ("sudden", "Grade 4"),
    ("test", "Grade 4"), ("direction", "Grade 4"), ("center", "Grade 4"), ("farmers", "Grade 4"),
    ("ready", "Grade 4"), ("anything", "Grade 4"), ("divided", "Grade 4"), ("general", "Grade 4"),
    ("energy", "Grade 4"), ("subject", "Grade 4"), ("Europe", "Grade 4"), ("moon", "Grade 4"),
    ("region", "Grade 4"), ("return", "Grade 4"), ("believe", "Grade 4"), ("dance", "Grade 4"),
    ("members", "Grade 4"), ("picked", "Grade 4"), ("simple", "Grade 4"), ("cells", "Grade 4"),
    ("paint", "Grade 4"), ("mind", "Grade 4"), ("love", "Grade 4"), ("cause", "Grade 4"),
    ("rain", "Grade 4"), ("exercise", "Grade 4"), ("eggs", "Grade 4"), ("train", "Grade 4"),
    ("blue", "Grade 4"), ("wish", "Grade 4"), ("drop", "Grade 4"), ("developed", "Grade 4"),
    ("window", "Grade 4"), ("difference", "Grade 4"), ("distance", "Grade 4"), ("heart", "Grade 4"),
    ("site", "Grade 4"), ("sum", "Grade 4"), ("summer", "Grade 4"), ("wall", "Grade 4"),
    ("forest", "Grade 4"), ("probably", "Grade 4"), ("legs", "Grade 4"), ("sat", "Grade 4"),
    ("main", "Grade 4"), ("winter", "Grade 4"), ("wide", "Grade 4"), ("written", "Grade 4"),
    ("length", "Grade 4"), ("reason", "Grade 4"), ("kept", "Grade 4"), ("interest", "Grade 4"),
    ("arms", "Grade 4"), ("brother", "Grade 4"), ("race", "Grade 4"), ("present", "Grade 4"),
    ("beautiful", "Grade 4"), ("store", "Grade 4"), ("job", "Grade 4"), ("edge", "Grade 4"),
    ("past", "Grade 4"), ("sign", "Grade 4"), ("record", "Grade 4"), ("finished", "Grade 4"),
    ("discovered", "Grade 4"), ("wild", "Grade 4"), ("happy", "Grade 4"), ("beside", "Grade 4"),
    ("gone", "Grade 4"), ("sky", "Grade 4"), ("glass", "Grade 4"), ("million", "Grade 4"),
    ("west", "Grade 4"), ("lay", "Grade 4"), ("weather", "Grade 4"), ("root", "Grade 4"),
    ("instruments", "Grade 4"), ("meet", "Grade 4"), ("third", "Grade 4"), ("months", "Grade 4"),
    ("paragraph", "Grade 4"), ("raised", "Grade 4"), ("represent", "Grade 4"), ("soft", "Grade 4"),
    ("whether", "Grade 4"), ("clothes", "Grade 4"), ("flowers", "Grade 4"), ("shall", "Grade 4"),
    ("teacher", "Grade 4"), ("held", "Grade 4"), ("describe", "Grade 4"), ("drive", "Grade 4"),
]

def seed_database():
    db = SessionLocal()
    try:
        # Check if words already exist
        existing_count = db.query(models.SightWord).count()
        if existing_count > 0:
            print(f"⚠️  Database already has {existing_count} words.")
            confirm = input("🔄 Do you want to clear and re-seed? (y/N): ")
            if confirm.lower() != 'y':
                print("❌ Seed cancelled.")
                return
            db.query(models.SightWord).delete()
            db.commit()
            print("🗑️  Existing words cleared.")

        # Track duplicates before inserting
        seen_words = set()
        unique_words = []
        duplicates = []

        for word, level in fry_words:
            if word in seen_words:
                duplicates.append(f"'{word}' (already in {level})")
            else:
                seen_words.add(word)
                unique_words.append((word, level))

        if duplicates:
            print(f"⚠️  Found {len(duplicates)} duplicate word(s) that were skipped:")
            for dup in duplicates[:5]:
                print(f"   - {dup}")
            if len(duplicates) > 5:
                print(f"   ... and {len(duplicates) - 5} more")

        print(f"📚 Seeding {len(unique_words)} unique Fry sight words...")
        for word, level in unique_words:
            db_word = models.SightWord(word=word, level=level)
            db.add(db_word)

        db.commit()
        print(f"✅ Successfully seeded {len(unique_words)} words across all levels!")

        # Show summary by level
        summary = db.query(models.SightWord.level, models.SightWord.word).all()
        level_counts = Counter(level for level, _ in summary)
        print("\n📊 Word counts by level:")
        for level in ['Pre-Primer', 'Primer', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4']:
            count = level_counts.get(level, 0)
            print(f"   {level}: {count} words")

        total = sum(level_counts.values())
        print(f"\n📚 TOTAL: {total} unique sight words")

    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🛠️  Fry Sight Word Database Seeder")
    seed_database()