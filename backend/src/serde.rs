use miden_client::{Felt, Word};

pub fn str_to_word(s: &str) -> Word {
    println!("Received string: {s}");

    let bytes = s.as_bytes();

    println!("bytes: {:?}", bytes);

    assert!(bytes.len() <= 24, "string `{s}` is too large");

    let mut padded_bytes = vec![0u8; 32];
    padded_bytes[..bytes.len()].copy_from_slice(bytes);
    padded_bytes[31] = bytes.len() as u8;

    println!("padded: {:?}", padded_bytes);

    assert!(padded_bytes.len() == 32);

    let mut word = Word::default();

    for i in 0..4 {
        let chunk_start = i * 8;
        let mut chunk = [0u8; 8];
        chunk.copy_from_slice(&padded_bytes[chunk_start..chunk_start + 8]);

        let value = u64::from_be_bytes(chunk);
        word[i] = Felt::new(value);
    }

    word
}

pub fn word_to_str(w: Word) -> String {
    // Get the string length from the last byte of the last Felt
    let last_bytes = w[3].as_int().to_be_bytes();
    let len = last_bytes[7] as usize;

    // Create a buffer for the full 32 bytes
    let mut bytes = Vec::with_capacity(32);

    // Extract all bytes from the Word
    for i in 0..4 {
        let value_bytes = w[i].as_int().to_be_bytes();
        bytes.extend_from_slice(&value_bytes);
    }

    // Truncate to the actual string length
    bytes.truncate(len);

    // Convert to string
    String::from_utf8(bytes).unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned())
}

#[cfg(test)]
mod tests {
    use crate::serde::{str_to_word, word_to_str};

    #[test]
    fn test_word_str_serde() {
        let s = "mirko.miden";
        let serialized = str_to_word(s);
        let deserialized = word_to_str(serialized);
        assert_eq!(s, deserialized);
    }

    #[test]
    fn test_longer_string() {
        let s = "This is a longer string to test serialization";
        // This should panic due to the length check
        let result = std::panic::catch_unwind(|| {
            str_to_word(s);
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_various_lengths() {
        let test_cases = [
            "",
            "a",
            "ab",
            "yas",
            "yas.miden",
            "paulhenry",
            "paulhenry.miden",
            "hello",
            "hello world",
            "012345678901234567890123", // 24 chars (maximum)
        ];

        for &s in &test_cases {
            let serialized = str_to_word(s);
            let deserialized = word_to_str(serialized);
            assert_eq!(s, deserialized, "Failed for string: {}", s);
        }
    }

    #[test]
    fn test_unicode() {
        let s = "Hello, 世界!"; // Contains non-ASCII Unicode chars
        let serialized = str_to_word(s);
        let deserialized = word_to_str(serialized);
        assert_eq!(s, deserialized);
    }

    #[test]
    fn test_max_length() {
        // Create a string exactly 24 bytes long
        let s = "123456789012345678901234"; // 24 ASCII chars = 24 bytes
        let serialized = str_to_word(s);
        let deserialized = word_to_str(serialized);
        assert_eq!(s, deserialized);
    }

    #[test]
    fn test_max_length_unicode() {
        // Unicode characters can be up to 4 bytes each in UTF-8
        // "世" is 3 bytes, so we need a mix to hit exactly 24 bytes
        let s = "123456789012345678世界"; // Should be exactly 24 bytes
        assert_eq!(
            s.as_bytes().len(),
            24,
            "Test string is not exactly 24 bytes"
        );

        let serialized = str_to_word(s);
        let deserialized = word_to_str(serialized);
        assert_eq!(s, deserialized);
    }
}
