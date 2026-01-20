
import { GoogleGenAI, Type } from "@google/genai";
import { Category, TransactionType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseSpendingInput = async (input: string): Promise<{
  amount: number;
  category: Category;
  type: TransactionType;
  description: string;
}> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy phân tích câu sau đây để lấy thông tin tài chính: "${input}". 
    
    Xác định loại giao dịch (type):
    - "income": lương, thưởng, được cho, bán đồ, ĐI VAY, MƯỢN TIỀN...
    - "expense": mua sắm, ăn uống, TRẢ NỢ, TRẢ THẺ TÍN DỤNG...
    - "saving": gửi tiết kiệm, bỏ ống heo, gửi ngân hàng...
    - "investment": mua vàng, chứng khoán, coin, đất đai, đầu tư vốn...

    Phân loại (category) tương ứng:
    - Nếu là income -> "${Category.INCOME}" (Nếu là vay/mượn tiền thì chọn "${Category.LOAN_DEBT}")
    - Nếu là saving -> "${Category.SAVING}"
    - Nếu là investment -> "${Category.INVESTMENT}"
    - Nếu liên quan đến trả nợ, trả thẻ, vay mượn -> "${Category.LOAN_DEBT}"
    - Nếu là expense thông thường, chọn trong: "${Category.FOOD}", "${Category.HANG_OUT}", "${Category.SHOPPING}", "${Category.OTHER}".
    
    QUY TẮC:
    1. "cafe", "ăn phố", "xem phim" -> "${Category.HANG_OUT}".
    2. "trả nợ", "trả tiền thẻ", "thanh toán thẻ tín dụng" -> type: "expense", category: "${Category.LOAN_DEBT}".
    3. "vay tiền", "mượn tiền", "rút thẻ tín dụng" -> type: "income", category: "${Category.LOAN_DEBT}".
    4. Chuyển đổi tiền tệ sang số nguyên (ví dụ: 30k -> 30000, 1tr5 -> 1500000).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          amount: {
            type: Type.NUMBER,
            description: "Số tiền (số nguyên).",
          },
          type: {
            type: Type.STRING,
            description: "Loại giao dịch: 'income', 'expense', 'saving', 'investment'.",
          },
          category: {
            type: Type.STRING,
            description: "Phân loại.",
          },
          description: {
            type: Type.STRING,
            description: "Mô tả ngắn gọn.",
          },
        },
        required: ["amount", "type", "category", "description"],
      },
    },
  });

  try {
    const result = JSON.parse(response.text || "{}");
    
    let finalCategory = Category.OTHER;
    if (Object.values(Category).includes(result.category as Category)) {
      finalCategory = result.category as Category;
    }

    // Fallback logic if AI messes up category but gets type right
    if (result.type === 'income' && finalCategory === Category.OTHER) finalCategory = Category.INCOME;
    if (result.type === 'saving') finalCategory = Category.SAVING;
    if (result.type === 'investment') finalCategory = Category.INVESTMENT;

    // Hard rule override for specific keywords
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes("cafe") || lowerInput.includes("ăn phố")) {
      finalCategory = Category.HANG_OUT;
      result.type = 'expense';
    }

    return {
      amount: result.amount || 0,
      type: (['income', 'expense', 'saving', 'investment'].includes(result.type) ? result.type : 'expense') as TransactionType,
      category: finalCategory,
      description: result.description || input,
    };
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    throw new Error("Không thể hiểu được nội dung nhập vào.");
  }
};
